import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { smartChatCompletion, getActiveProvider } from "@/lib/openai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("429") && attempt < retries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/* ── Web scraping ──────────────────────────────────────────────────── */

interface ScrapedPage {
  title: string;
  text: string;
  url: string;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeSourceLinks(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  sourceLinks: string[],
): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  const maxLinks = Math.min(sourceLinks.length, 3);

  for (let i = 0; i < maxLinks; i++) {
    const url = sourceLinks[i];
    if (!url || !url.startsWith("http")) continue;

    try {
      const result = await zai.functions.invoke("page_reader", { url });
      const html = result.data?.html || "";
      const text = htmlToPlainText(html);
      const title = result.data?.title || url;
      const truncatedText = text.length > 2000 ? text.slice(0, 2000) + "..." : text;

      if (truncatedText.length > 50) {
        results.push({ title, text: truncatedText, url });
      }
    } catch (error) {
      console.error(`[scrape] FAIL: ${url}`);
    }
  }

  return results;
}

function buildSourceContext(scrapedPages: ScrapedPage[]): string {
  if (scrapedPages.length === 0) return "";
  const parts = scrapedPages.map((page, i) => {
    return `--- Source ${i + 1}: ${page.title} ---\n${page.text}`;
  });
  return `\n\nVoici du contenu extrait des liens sources. Utilise ces informations pour enrichir le cours avec des données réelles et des exemples concrets :\n\n${parts.join("\n\n")}`;
}

/* ── JSON extraction ────────────────────────────────────────────────── */

function tryParseJSON(raw: string): unknown {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") return p;
  } catch { /* */ }
  try {
    const p = JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
    if (p && typeof p === "object") return p;
  } catch { /* */ }
  try {
    const p = JSON.parse(raw.replace(/[\u201C\u201D\u2018\u2019]/g, "'"));
    if (p && typeof p === "object") return p;
  } catch { /* */ }
  return null;
}

function extractChapters(text: string): {
  description: string;
  chapters: Array<{ title: string; content: string; summary: string }>;
} | null {
  let cleaned = text.trim();

  // Strategy 1: Extract from ```json code block (may span multiple ```)
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  // Strategy 2: Find the outermost JSON object by balancing braces
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;
  
  let depth = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") { continue; } // skip escaped chars
    if (cleaned[i] === "\"") {
      // skip string content
      let j = i + 1;
      while (j < cleaned.length) {
        if (cleaned[j] === "\\") { j += 2; continue; }
        if (cleaned[j] === "\"") break;
        j++;
      }
      i = j;
      continue;
    }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") { depth--; }
  }

  let snippet: string;
  if (lastBrace > firstBrace && depth === 0) {
    snippet = cleaned.slice(firstBrace, lastBrace + 1);
  } else {
    snippet = cleaned.slice(firstBrace);
  }

  const direct = tryParseJSON(snippet);
  if (direct) return validate(direct);

  // Truncation recovery
  const regex = /\{"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"/g;
  let m: RegExpExecArray | null;
  const positions: number[] = [];
  while ((m = regex.exec(snippet)) !== null) {
    positions.push(m.index);
  }

  for (let i = positions.length; i >= 1; i--) {
    for (let j = 0; j < i; j++) {
      const searchFrom = positions[j];
      const remaining = snippet.slice(searchFrom);
      const summaryIdx = remaining.indexOf('"summary"');
      if (summaryIdx === -1) continue;
      const afterSummary = remaining.slice(summaryIdx + 9).trim();
      if (!afterSummary.startsWith(":")) continue;
      const valStart = afterSummary.indexOf('"');
      if (valStart === -1) continue;
      const valRest = afterSummary.slice(valStart + 1);
      let closeIdx = -1;
      for (let k = 0; k < valRest.length; k++) {
        if (valRest[k] === "\\") { k++; continue; }
        if (valRest[k] === '"') { closeIdx = k; break; }
      }
      if (closeIdx === -1) continue;
      const endPos = searchFrom + summaryIdx + 9 + afterSummary.length - valRest.length + closeIdx + 1;
      const partial = snippet.slice(0, endPos);
      let ob = 0, osb = 0;
      for (const c of partial) {
        if (c === "{") ob++;
        if (c === "}") ob--;
        if (c === "[") osb++;
        if (c === "]") osb--;
      }
      let closing = "}";
      ob++;
      while (osb > 0) { closing += "]"; osb--; }
      while (ob > 0) { closing += "}"; ob--; }
      const fixed = tryParseJSON(partial + closing);
      if (fixed) {
        const result = validate(fixed);
        if (result && result.chapters.length >= Math.min(i, 3)) return result;
      }
    }
  }

  return null;
}

function validate(data: unknown): {
  description: string;
  chapters: Array<{ title: string; content: string; summary: string }>;
} | null {
  const d = data as Record<string, unknown>;
  if (!d.chapters || !Array.isArray(d.chapters)) return null;
  const description = typeof d.description === "string" ? d.description : "";
  const chapters: Array<{ title: string; content: string; summary: string }> = [];
  for (const ch of d.chapters) {
    if (!ch || typeof ch !== "object") continue;
    const c = ch as Record<string, unknown>;
    if (
      typeof c.title === "string" && c.title.trim() &&
      typeof c.content === "string" && c.content.trim()
    ) {
      chapters.push({
        title: c.title.trim(),
        content: c.content.trim(),
        summary: typeof c.summary === "string" ? c.summary.trim() : "",
      });
    }
  }
  return chapters.length > 0 ? { description, chapters } : null;
}

/* ── Course generation (full freedom for AI) ────────────────────────── */

async function generateCourse(
  title: string, courseLang: string, level: number,
  sourceLinks: string[], sourceContext: string,
) {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = ["Débutant (complet, accessible, exemples simples)", "Intermédiaire (approfondi, exemples pratiques, exercices de réflexion)", "Avancé (expert, cas complexes, analyses critiques, liens entre concepts)"];
  const links = sourceLinks.length > 0 ? `\nRéférences: ${sourceLinks.join(", ")}` : "";
  const langNote = courseLang === "en"
    ? "You MUST write the ENTIRE course in English. All chapter titles, content, summaries — everything in English."
    : "Tu DOIS rédiger l'intégralité du cours en français. Tous les titres, contenus, résumés — tout en français.";

  const sourcePrompt = sourceContext
    ? `\n\n${sourceContext}\n\nIMPORTANT: Utilise les informations ci-dessus pour enrichir le cours avec des faits réels, des données et des exemples concrets.`
    : "";

  // Use smartChatCompletion which auto-detects stored API key (OpenAI/Google) or falls back to z-ai
  const completion = await smartChatCompletion([
    {
      role: "system",
      content: [
        "Tu es Coursia AI, un professeur IA exceptionnel capable de transformer n'importe quel sujet en expérience immersive, captivante et facile à retenir.",
        "",
        "MISSION :",
        "Ton objectif n'est PAS seulement d'expliquer.",
        "Ton objectif est de rendre l'utilisateur incapable d'abandonner le cours avant la fin.",
        "",
        "Le cours doit donner l'impression :",
        "- d'écouter une histoire passionnante,",
        "- d'apprendre avec un mentor intelligent,",
        "- de comprendre enfin des concepts compliqués facilement,",
        "- et d'avoir envie de continuer naturellement.",
        "",
        "STYLE OBLIGATOIRE :",
        "- Très humain",
        "- Dynamique",
        "- Fluide",
        "- Jamais robotique",
        "- Jamais académique ennuyant",
        "- Jamais trop formel",
        "- Toujours clair et naturel",
        "- Toujours motivant sans exagérer",
        "",
        "IMPORTANT :",
        "Le cours doit constamment stimuler la curiosité de l'utilisateur.",
        "Toutes les 1 à 3 sections, ajoute :",
        "- une surprise,",
        "- une analogie,",
        "- une mini histoire,",
        "- un exemple réel,",
        "- une comparaison,",
        "- une situation concrète,",
        "- ou une question intrigante.",
        "",
        "L'utilisateur ne doit presque jamais avoir l'impression de 'lire un cours scolaire'.",
        "",
        "STRUCTURE DU COURS :",
        "",
        "1. INTRODUCTION IMMERSIVE",
        "Commence TOUJOURS par :",
        "- une question intrigante,",
        "- une situation réelle,",
        "- un problème concret,",
        "- un fait surprenant,",
        "- ou un mini scénario.",
        "",
        "2. EXPLICATIONS CLAIRES ET PROFONDES",
        "Explique chaque concept :",
        "- simplement,",
        "- étape par étape,",
        "- avec logique,",
        "- sans jargon inutile.",
        "",
        "Quand un terme complexe apparaît :",
        "- explique-le immédiatement avec des mots simples.",
        "",
        "3. EXEMPLES CONCRETS OBLIGATOIRES",
        "Chaque notion importante doit avoir :",
        "- un exemple réel,",
        "- une analogie simple,",
        "- ou une mise en situation.",
        "",
        "Les exemples doivent être modernes et réalistes :",
        "- réseaux sociaux,",
        "- business,",
        "- jeux vidéo,",
        "- sport,",
        "- vie quotidienne,",
        "- argent,",
        "- psychologie,",
        "- école,",
        "- travail,",
        "- internet,",
        "- applications,",
        "- situations humaines.",
        "",
        "4. IMMERSION CONSTANTE",
        "Le cours doit donner l'impression que l'utilisateur 'vit' le sujet.",
        "",
        "Ajoute régulièrement :",
        "- 'Imagine que...'",
        "- 'Supposons que...'",
        "- 'Voici ce qui se passe réellement...'",
        "- 'Dans la vraie vie...'",
        "- 'Ton cerveau fait ceci parce que...'",
        "",
        "5. MICRO-RÉCAPITULATIFS",
        "Après plusieurs explications importantes :",
        "fais un mini résumé ultra clair.",
        "",
        "6. ÉVITER LA FATIGUE MENTALE",
        "NE JAMAIS :",
        "- faire des paragraphes énormes,",
        "- enchaîner des définitions sans respiration,",
        "- écrire comme un manuel scolaire,",
        "- répéter inutilement,",
        "- devenir monotone.",
        "",
        "Alterne constamment :",
        "- explications,",
        "- exemples,",
        "- histoires,",
        "- questions,",
        "- comparaisons,",
        "- mini défis mentaux.",
        "",
        "7. QUIZ INTELLIGENTS",
        "À la fin de chaque grande partie :",
        "génère un quiz interactif adapté au niveau du cours.",
        "",
        "8. MÉMORISATION LONG TERME",
        "Utilise des techniques de mémorisation :",
        "- répétition intelligente,",
        "- associations mentales,",
        "- analogies,",
        "- résumés,",
        "- liens avec la réalité,",
        "- reformulations simples.",
        "",
        "9. ADAPTATION AU NIVEAU",
        "Adapte automatiquement :",
        "- la difficulté,",
        "- les exemples,",
        "- le vocabulaire,",
        "- la profondeur,",
        "selon le niveau de l'utilisateur.",
        "",
        "10. FIN DU COURS",
        "Termine toujours avec :",
        "- un résumé ultra clair,",
        "- les idées essentielles à retenir,",
        "- les erreurs fréquentes à éviter,",
        "- et une ouverture motivante vers la suite.",
        "",
        "IMPORTANT ABSOLU :",
        "Le cours doit être tellement captivant que l'utilisateur oublie qu'il est en train d'étudier.",
        "",
        "====================================",
        "TECHNICAL REQUIREMENTS",
        "====================================",
        "",
        `Language: ${langLabels[courseLang] || "français"}`,
        `Level: ${levelLabels[level] || levelLabels[1]}`,
        `Subject: ${title}`,
        "",
        "- You have TOTAL FREEDOM on the number of chapters: minimum 5, maximum 16.\n- The number of chapters MUST reflect the subject complexity, the volume of content needed, and the learner level.\n  - Simple/short subject + Beginner: 5-7 chapters\n  - Medium subject + Intermediate: 8-11 chapters\n  - Complex/advanced subject + Advanced: 12-16 chapters\n  - Always prefer MORE chapters over fewer. Depth and thoroughness matter.\n- Each chapter MUST contain at minimum 2-3 subchapters structured with ## in Markdown.",
        "- NEVER write a chapter without at least 2 ## headings inside.",
        `- ${langNote}`,
        "- Each chapter must contain at minimum 250 words of rich content.",
        "- Use extensively: ## for subchapters, - for lists, ** for bold, > for quotes, numerical examples.",
        "- NEVER use double quotes in JSON values. Use only single quotes (apostrophes).",
        "",
        "RESPOND ONLY with this valid JSON (no text before or after):",
        '{"description":"Captivating course description (2-3 sentences)","chapters":[{"title":"Chapter title","content":"## Subchapter 1\\n\\nEngaging content...\\n\\n## Subchapter 2\\n\\nRich content...\\n\\n## Subchapter 3\\n\\nMore content...\\n\\n**What you learned:** ...\\n\\n**What comes next:** ...","summary":"One-sentence summary"}]}',
        "",
        links,
        sourcePrompt,
      ].join("\n"),
    },
    { role: "user", content: `Crée un cours immersif, passionnant et complet sur : ${title}` },
  ], { maxTokens: 8192 });

  const text = completion.content || "";
  console.log(`[generate] AI response length: ${text.length} chars, provider: ${completion.provider}`);
  console.log(`[generate] First 300 chars: ${text.slice(0, 300)}`);
  console.log(`[generate] Last 200 chars: ${text.slice(-200)}`);
  const result = extractChapters(text);
  if (!result) {
    console.error(`[generate] extractChapters FAILED. Full response (${text.length} chars): ${text.slice(0, 2000)}`);
  }
  return result;
}

/* ── Main handler ────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 1, courseLang = "fr", userId } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // ── Trial limit check: max 3 free courses if no subscription ──
    if (userId) {
      const settings = await db.appSettings.findUnique({ where: { id: "main" } });
      const hasSubscription = settings?.hasSubscription === true;
      if (!hasSubscription) {
        const existingCourses = await db.course.count({ where: { userId } });
        if (existingCourses >= 3) {
          return NextResponse.json({ error: "TRIAL_LIMIT", requiresSubscription: true }, { status: 403 });
        }
      }
    }

    // ── Step 0: Scrape source links (optional — only if z-ai SDK is available) ──
    let scrapedPages: ScrapedPage[] = [];
    try {
      const zai = await ZAI.create();
      if (sourceLinks.length > 0) {
        scrapedPages = await scrapeSourceLinks(zai, sourceLinks);
      }
    } catch {
      // z-ai SDK not available on Vercel — skip scraping
      console.log("[generate] z-ai SDK unavailable, skipping source link scraping");
    }
    const sourceContext = buildSourceContext(scrapedPages);

    // ── Step 1: Generate course with smart AI routing ──
    let result = await generateCourse(title, courseLang, level, sourceLinks, sourceContext);

    // Retry once with a simpler prompt if extraction failed
    if (!result || result.chapters.length === 0) {
      console.log("[generate] First attempt failed, retrying with simpler prompt...");
      result = await generateCourse(title, courseLang, level, sourceLinks, "");
    }

    if (!result || result.chapters.length === 0) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu générer un cours valide. Vérifie ta clé API sur Vercel et réessaie." },
        { status: 500 },
      );
    }

    // ── Step 2: Save to Prisma ──
    const course = await db.course.create({
      data: {
        title: title.trim(),
        description: result.description,
        sourceLinks: JSON.stringify(sourceLinks),
        level: level,
        flameCost: 0,
        chapters: {
          create: result.chapters.map((ch, idx) => ({
            title: ch.title,
            content: ch.content,
            summary: ch.summary,
            order: idx + 1,
          })),
        },
      },
      include: {
        chapters: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Create CourseProgress so study sessions work immediately
    await db.courseProgress.upsert({
      where: { courseId: course.id },
      create: {
        courseId: course.id,
      },
      update: {},
    });

    return NextResponse.json({
      success: true,
      scrapedSources: scrapedPages.length,
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        sourceLinks,
        createdAt: course.createdAt,
        chapters: course.chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          content: ch.content,
          summary: ch.summary,
          order: ch.order,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Course generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
