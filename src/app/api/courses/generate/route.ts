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
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  const start = cleaned.indexOf("{");
  if (start === -1) return null;
  const snippet = cleaned.slice(start);

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
        `Tu es un expert pédagogue passionné qui crée des cours captivants et mémorables.`,
        "",
        `MISSION : Crée un cours complet en ${langLabels[courseLang] || "français"}.`,
        `Niveau : ${levelLabels[level] || levelLabels[1]}`,
        `Sujet : ${title}`,
        "",
        "RÈGLES CRITIQUES :",
        "",
        "1. STRUCTURE DES CHAPITRES :",
        "- Tu as la LIBERTÉ TOTALE sur le nombre de chapitres. Crée le nombre qui correspond au sujet : 3, 5, 7, 10, 12, 15... autant que nécessaire.",
        "",
        "2. SOUS-CHAPITRES (OBLIGATOIRE) :",
        "- Chaque chapitre DOIT contenir au minimum 2-3 sous-chapitres structurés avec ## en Markdown.",
        "- Les sous-chapitres doivent explorer différents aspects du thème du chapitre.",
        "- Exemple de structure attendue pour un contenu :",
        '  "## Introduction au concept\\n\\nTexte introductif...\\n\\n## Principes fondamentaux\\n\\n- Point 1\\n- Point 2\\n\\n## Applications pratiques\\n\\nExemples concrets..."',
        "- NE JAMAIS écrire un chapitre sans au moins 2 titres ## dedans.",
        "",
        "3. QUALITÉ DU CONTENU :",
        "- Le contenu DOIT ÊTRE captivant. Utilise des exemples concrets, des analogies, des anecdotes, des faits surprenants, des questions rhétoriques.",
        "- PAS de texte ennuyeux ni académique sec. Écris comme un storyteller passionné.",
        `- ${langNote}`,
        "- Chaque chapitre doit contenir au minimum 250 mots de contenu riche.",
        "- Utilise largement : ## pour sous-chapitres, - pour listes, ** pour gras, > pour citations, des exemples numériques.",
        "- Aucun guillemet double dans les valeurs JSON. Utilise seulement des apostrophes (').",
        "",
        "RÉPONDS UNIQUEMENT avec ce JSON valide (pas de texte avant ni après) :",
        '{"description":"Brève description captivante du cours (2-3 phrases)","chapters":[{"title":"Titre du chapitre","content":"## Sous-chapitre 1\\n\\nContenu riche...\\n\\n## Sous-chapitre 2\\n\\nContenu riche...\\n\\n## Sous-chapitre 3\\n\\nContenu riche...","summary":"Résumé en 1 phrase"}]}',
        "",
        links,
        sourcePrompt,
      ].join("\n"),
    },
    { role: "user", content: `Crée un cours passionnant et complet sur : ${title}` },
  ], { maxTokens: 8192 });

  const text = completion.content || "";
  return extractChapters(text);
}

/* ── Main handler ────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 1, courseLang = "fr" } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // ── Step 0: Scrape source links ──
    const zai = await ZAI.create();
    let scrapedPages: ScrapedPage[] = [];
    if (sourceLinks.length > 0) {
      scrapedPages = await scrapeSourceLinks(zai, sourceLinks);
    }
    const sourceContext = buildSourceContext(scrapedPages);

    // ── Step 1: Generate course with smart AI routing ──
    let result = await generateCourse(title, courseLang, level, sourceLinks, sourceContext);

    if (!result || result.chapters.length === 0) {
      throw new Error("L'IA n'a pas pu générer un cours valide. Réessaie.");
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
