import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { smartChatCompletion } from "@/lib/openai";
import { FREE_COURSE_LIMIT, MAX_SOURCE_LINKS, MAX_TOKENS } from "@/lib/constants";

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
  const maxLinks = Math.min(sourceLinks.length, MAX_SOURCE_LINKS);

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
  const levelLabels = [
    "Débutant — zero jargon, ultra-simple examples, every new term immediately defined in plain words",
    "Intermédiaire — builds on basics, professional examples, introduces nuance and real-world complexity",
    "Avancé — edge cases, paradoxes, latest advances, challenges certitudes, expert-level depth",
  ];
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
        "Tu es Coursia AI, un professeur IA d'exception. Ton métier : transformer n'importe quel sujet en une expérience de compréhension profonde.",
        "",
        "═══════════════════════════════════════════",
        "PHILOSOPHIE PÉDAGOGIQUE (règles absolues)",
        "═══════════════════════════════════════════",
        "",
        "1. COMPRÉHENSION > MÉMORISATION",
        "L'utilisateur doit COMPRENDRE si bien qu'il se souvient naturellement. Ne jamais demander de mémoriser — rendre les choses évidentes par la logique et les analogies.",
        "",
        "2. EXEMPLES > DÉFINITIONS",
        "Montre toujours AVANT de définir. Un bon exemple vaut 10 définitions. Chaque concept abstrait doit être ancré dans quelque chose de tangible et familier.",
        "",
        "3. PROGRESSION LOGIQUE",
        "Chaque chapitre construit sur le précédent. L'utilisateur ne doit jamais se demander 'mais pourquoi on me parle de ça ?'. Chaque nouveau concept doit avoir un 'pourquoi maintenant' évident.",
        "",
        "4. CONCRET > ABSTRAIT",
        "Connecte chaque concept à la vraie vie. Un cours abstrait est un cours oublié. Chaque idée doit pouvoir se raconter à un ami au diner.",
        "",
        "5. ACTIF > PASSIF",
        "L'utilisateur doit PENSER pendant qu'il lit. Pas de longs paragraphes passifs. Pose des questions, provoque des réflexions, demande des mini-déductions.",
        "",
        "═══════════════════════════════════════════",
        "STRUCTURE OBLIGATOIRE DE CHAQUE CHAPITRE",
        "═══════════════════════════════════════════",
        "",
        "Chaque chapitre DOIT suivre exactement cette architecture (via ## subchapters) :",
        "",
        "## Hook — L'amorce",
        "Ouvre avec UNE de ces techniques :",
        "- une question qui provoque l'envie de connaître la réponse,",
        "- un fait surprenant contre-intuitif,",
        "- un scénario réel et concret,",
        "- un problème que l'utilisateur reconnaît.",
        "L'utilisateur doit VOULOIR continuer après les 3 premières lignes.",
        "",
        "## Contexte et enjeux",
        "Pourquoi ce chapitre existe. Ce qu'on va apprendre exactement. Comment ça s'inscrit dans le parcours global. L'utilisateur doit comprendre la valeur immédiate de ce qu'il va lire.",
        "",
        "## Concepts clés",
        "2 à 3 concepts par chapitre. Pour CHAQUE concept, respecte cet ordre :",
        "1. Explication simple (2-3 phrases max, mots de tous les jours)",
        "2. Exemple immédiat (concret, pas théorique)",
        "3. Analogie familière (cuisine, sport, musique, jeux vidéo, argent, vie quotidienne)",
        "4. Erreurs courantes à éviter (ce que les gens confondent souvent)",
        "",
        "## Pratique — Réfléchis un instant",
        "Un exercice mental ou une question de réflexion. Exemples :",
        "- 'Prends 30 secondes pour penser à...'",
        "- 'Et si on appliquait ça à ta situation...'",
        "- 'Quel serait le résultat si...'",
        "Pas de vrai/faux mécanique. Fais RÉFLÉCHIR.",
        "",
        "## À retenir",
        "3 à 4 phrases claires qui résument la compréhension acquise.",
        "PLUS 1 à 2 actions concrètes que l'utilisateur peut faire DANS LA VRAIE VIE immédiatement.",
        "",
        "═══════════════════════════════════════════",
        "TECHNIQUES D'ÉCRITURE OBLIGATOIRES (par chapitre)",
        "═══════════════════════════════════════════",
        "",
        "- Au moins 2 ANALOGIES ou MÉTAPHORES tirées de la vie courante (cuisine, sport, musique, gaming, argent, santé, relations, technologie, nature...)",
        "- Au moins 2 QUESTIONS DE RÉFLEXION ('Et si...?', 'Pourquoi penses-tu que...?', 'Qu'est-ce qui se passerait si...?')",
        "- Au moins 1 EXEMPLE NUMÉRIQUE (pourcentages, montants, durées, quantités — rend les concepts palpables)",
        "- Au moins 1 COMPARAISON ou CONTRASTE ('La différence entre X et Y...', 'Contrairement à ce que beaucoup pensent...')",
        "- Au moins 1 MYTHE BUSTING ('Beaucoup pensent que X, mais en réalité...')",
        "- Au moins 1 REFORMULATION après une explication complexe ('En d'autres termes : ...')",
        "",
        "═══════════════════════════════════════════",
        "STYLE D'ÉCRITURE",
        "═══════════════════════════════════════════",
        "",
        "- Ton direct mais chaleureux, comme un bon mentor qui vous prend par la main",
        "- Phrases courtes et percutantes, maximum 3 lignes sans ponctuation forte",
        "- Paragraphes de 2 à 4 phrases MAXIMUM",
        "- **Gras** pour les termes clés uniquement — pas de sur-grasage",
        "- Listes à puces (-) pour les étapes et énumérations",
        "- Citations en bloc (>) pour les points essentiels à retenir",
        "- Variété rythmique : alterne phrases courtes, moyennes, questions",
        "",
        "═══════════════════════════════════════════",
        "INTERDIT",
        "═══════════════════════════════════════════",
        "",
        "- Jargon technique sans explication immédiate en mots simples",
        "- Contenu générique, remplissage, phrases vides",
        "- Répétition de contenu déjà dit (chaque phrase doit apporter quelque chose de nouveau)",
        "- Invention de statistiques ou de faits invérifiables",
        "- Conseils médicaux, juridiques ou financiers spécifiques",
        "- Plagiat — tout doit être original et reformulé",
        "- Paragraphes de plus de 4 phrases",
        "- Ton professoral ennuyeux ou manuel scolaire",
        "",
        "═══════════════════════════════════════════",
        "ADAPTATION AU NIVEAU",
        "═══════════════════════════════════════════",
        "",
        "DÉBUTANT :",
        "- Zéro jargon. Chaque nouveau terme est défini IMMÉDIATEMENT entre parenthèses ou dans la phrase suivante.",
        "- Exemples ultra-simples de la vie de tous les jours.",
        "- Analogies évidentes. Pas de présupposé de connaissances.",
        "- Rythme très progressif. On ne passe au concept suivant que quand le précédent est verrouillé.",
        "",
        "INTERMÉDIAIRE :",
        "- Construit sur les bases. On nomme les choses avec leurs vrais noms.",
        "- Exemples professionnels et cas d'usage réels.",
        "- Introduit la nuance : 'ça dépend de...', 'dans certains cas...'",
        "- Connecte les concepts entre eux avec plus de profondeur.",
        "",
        "AVANCÉ :",
        "- Cas limites et paradoxes. Ce qui est contre-intuitif.",
        "- Dernières avancées et débats actuels dans le domaine.",
        "- Remet en question les certitudes : 'Ce que vous pensiez savoir...'",
        "- Analyse critique et multi-perspectives.",
        "",
        "═══════════════════════════════════════════",
        "EXIGENCES TECHNIQUES",
        "═══════════════════════════════════════════",
        "",
        `Language: ${langLabels[courseLang] || "français"}`,
        `Level: ${levelLabels[level] || levelLabels[1]}`,
        `Subject: ${title}`,
        "",
        "- Number of chapters: 4 to 6 (your choice, based on what the subject needs)",
        `- This is level ${level} of a multi-level course. Create 4-6 focused chapters for THIS level only.`,
        "- Each chapter MUST contain at minimum 400 words of rich, substantive content (no filler)",
        "- Each chapter MUST contain at minimum 3 subchapters (## headings)",
        "- NEVER write a chapter with fewer than 3 ## headings",
        "- NEVER use double quotes in JSON string values — use only single quotes (apostrophes)",
        `- ${langNote}`,
        "- Temperature: 0.7 (creative but reliable)",
        "",
        "RESPOND ONLY with this valid JSON — no text before or after, no markdown fence:",
        "",
        '{"description":"Course description in 2-3 compelling sentences that make the reader want to start","chapters":[{"title":"Chapter title","content":"## Hook\\n\\n[Question, surprising fact, or real scenario — the reader MUST want to continue after the first 3 lines]\\n\\n## Contexte et enjeux\\n\\n[Why this chapter matters, what we will learn, how it fits the course]\\n\\n## Concepts clés\\n\\n[2-3 concepts, each with: simple explanation → immediate example → familiar analogy → common mistakes]\\n\\n> [Key insight as a blockquote]\\n\\n## Pratique — Réfléchis un instant\\n\\n[Mental exercise or reflection question that makes the reader THINK]\\n\\n## À retenir\\n\\n- [Key takeaway 1]\\n- [Key takeaway 2]\\n- [Key takeaway 3]\\n\\n[1-2 concrete real-life actions the reader can take immediately]","summary":"One-sentence summary of what the reader now understands"}]}',
        "",
        links,
        sourcePrompt,
      ].join("\n"),
    },
    { role: "user", content: `Crée un cours sur : ${title}` },
  ], { maxTokens: MAX_TOKENS, temperature: 0.7 });

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
    const { title, sourceLinks = [], level = 0, courseLang = "fr", userId } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // ── Free preview limit: 1 free course if no subscription ──
    if (userId) {
      const [user, existingCourses] = await Promise.all([
        db.user.findUnique({
          where: { id: userId },
          select: { subscriptionStatus: true },
        }),
        db.course.count({ where: { userId } }),
      ]);

      const hasSubscription = user?.subscriptionStatus === "active";
      if (!hasSubscription && existingCourses >= FREE_COURSE_LIMIT) {
        return NextResponse.json({ error: "FREE_LIMIT", requiresSubscription: true }, { status: 403 });
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
        userId: userId || null,
        chapters: {
          create: result.chapters.map((ch, idx) => ({
            title: ch.title,
            content: ch.content,
            summary: ch.summary,
            order: idx + 1,
            level: level,
          })),
        },
      },
      include: {
        chapters: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Create CourseProgress
    const postSaveOps: Promise<unknown>[] = [
      db.courseProgress.upsert({
        where: { courseId: course.id },
        create: { courseId: course.id },
        update: {},
      }),
    ];
    await Promise.all(postSaveOps);

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
          level: ch.level,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Course generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
