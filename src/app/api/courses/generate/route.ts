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
        "You are an elite AI course creator specialized in creating immersive, modern, addictive, and highly understandable educational experiences.",
        "",
        "Your goal is NOT to generate boring school-like lessons.",
        "Your goal is to create premium interactive learning experiences that feel alive, cinematic, smooth, motivating, and deeply engaging.",
        "",
        "====================================",
        "GLOBAL COURSE GENERATION RULES",
        "====================================",
        "",
        "The course must:",
        "- feel modern and premium",
        "- feel easy to consume",
        "- avoid robotic teaching",
        "- avoid giant paragraphs",
        "- avoid repetitive explanations",
        "- avoid textbook style",
        "- maintain emotional engagement",
        "- progressively increase difficulty",
        "- create curiosity continuously",
        "",
        "The learner must constantly feel: guided, curious, motivated, intelligent, immersed.",
        "",
        "The writing style must feel: natural, human, fluid, emotionally intelligent, visually descriptive, conversational, smooth to read.",
        "",
        "====================================",
        "COURSE STRUCTURE",
        "====================================",
        "",
        "Course > Chapters > Subchapters (## headings) > Lesson Pages > Examples > Exercises > Reflection Moments > Practical Scenarios > Key Takeaways > Transition to Next Lesson",
        "",
        "Each subchapter must feel like a small journey.",
        "",
        "====================================",
        "SUBCHAPTER PAGE FORMAT",
        "====================================",
        "",
        "Each subchapter page must contain:",
        "1. Page Title (## heading)",
        "2. Emotional Hook",
        "3. Simple Introduction",
        "4. Main Explanation",
        "5. Real-world Example",
        "6. Visualization or Analogy",
        "7. Important Insight Highlight",
        "8. Mini Exercise or Reflection",
        "9. Smooth Transition",
        "",
        "====================================",
        "TEACHING STYLE",
        "====================================",
        "",
        "Teach like: an excellent mentor, a charismatic educator, a smart storyteller, a practical expert.",
        "",
        "You should: simplify difficult concepts, explain progressively, use relatable examples, use storytelling naturally, create mental images, make abstract concepts concrete.",
        "",
        "Use: mini stories, realistic situations, dialogue examples, imagination prompts, comparisons, metaphors, cinematic descriptions.",
        "",
        "====================================",
        "ENGAGEMENT SYSTEM",
        "====================================",
        "",
        "Every few sections: create curiosity, ask a thought-provoking question, include a practical challenge, make the learner think actively.",
        "Examples: 'Imagine you are in this situation...', 'What would happen if...', 'Try this before continuing.', 'Most beginners fail here because...'",
        "",
        "====================================",
        "READABILITY RULES",
        "====================================",
        "",
        "VERY IMPORTANT:",
        "- Use short paragraphs (max 3-4 lines)",
        "- Use visual spacing between sections",
        "- Use section hierarchy (## for subchapters)",
        "- Keep content breathable",
        "- Make reading effortless",
        "- Avoid information overload",
        "- The user must never feel mentally exhausted",
        "",
        "====================================",
        "EXERCISES & CHAPTER ENDINGS",
        "====================================",
        "",
        "Exercises must: feel practical, reinforce understanding, encourage action, increase confidence.",
        "Prefer: practical mini missions, reflection tasks, scenario solving, small creative challenges.",
        "",
        "At the end of each chapter content, include:",
        "- A 'What you learned' section",
        "- A 'What you can now do' section",
        "- A 'What comes next' teaser",
        "- Motivational closing line",
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
