import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

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

  // Direct parse
  const direct = tryParseJSON(snippet);
  if (direct) return validate(direct);

  // Truncation recovery: find all complete chapters
  // Match each chapter object that has title, content, and summary
  const chapterBlocks: string[] = [];
  const regex = /\{"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(snippet)) !== null) {
    chapterBlocks.push(m.index.toString());
  }

  // Try parsing from each position, keeping the most chapters we can
  const positions = chapterBlocks.map(Number);
  for (let i = positions.length; i >= 1; i--) {
    // Build JSON up to i-th chapter's "summary" end
    for (let j = 0; j < i; j++) {
      const searchFrom = positions[j];
      const remaining = snippet.slice(searchFrom);

      // Find "summary" key after this position
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

      // Count and close braces
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

/* ── Generation approaches ───────────────────────────────────────────── */

/** Attempt 1: Single call, very concise */
async function generateSingleCall(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  title: string, courseLang: string, level: number, sourceLinks: string[],
) {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = ["Débutant", "Intermédiaire", "Avancé"];
  const links = sourceLinks.length > 0 ? `\nRéférences: ${sourceLinks.join(", ")}` : "";

  const completion = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: [
            `Expert pédagogue. Crée un cours en ${langLabels[courseLang] || "français"}. Niveau ${levelLabels[level] || "Intermédiaire"}.`,
            "Réponds UNIQUEMENT avec ce JSON valide :",
            '{"description":"...","chapters":[{"title":"...","content":"Markdown 100-140 mots","summary":"10 mots"}]}',
            "",
            "Règles STRICTES :",
            "- 5 chapitres exactement",
            "- content: 100-140 mots MAX, très concis",
            "- Utilise ## sous-titres, - listes, ** gras",
            "- Aucun guillemet dans les valeurs (seulement apostrophes)",
            "- Pas de texte avant/après le JSON" + links,
          ].join("\n"),
        },
        { role: "user", content: `Cours concis sur: ${title}` },
      ],
      thinking: { type: "disabled" },
    })
  );

  const text = completion.choices[0]?.message?.content || "";
  return extractChapters(text);
}

/** Attempt 2: Two-step — structure then content one by one */
async function generateTwoStep(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  title: string, courseLang: string, level: number, sourceLinks: string[],
) {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = ["Débutant", "Intermédiaire", "Avancé"];
  const links = sourceLinks.length > 0 ? `\nRéférences: ${sourceLinks.join(", ")}` : "";
  const langNote = courseLang === "en" ? "Write in English." : "Rédige en français.";

  // Step 1: structure
  const structCompletion = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: [
            `Expert pédagogue. Crée un plan de cours en ${langLabels[courseLang] || "français"}. Niveau ${levelLabels[level]}.`,
            "JSON UNIQUEMENT :",
            '{"description":"...","chapters":[{"title":"...","summary":"10 mots"}]}',
            "- 5 chapitres. Aucun guillemet dans les valeurs. Pas de texte avant/après." + links,
          ].join("\n"),
        },
        { role: "user", content: `Plan du cours: ${title}` },
      ],
      thinking: { type: "disabled" },
    })
  );

  let structText = structCompletion.choices[0]?.message?.content || "";
  const cb = structText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) structText = cb[1].trim();
  const structStart = structText.indexOf("{");
  if (structStart !== -1) structText = structText.slice(structStart);

  const struct = tryParseJSON(structText) as {
    description?: string;
    chapters?: Array<{ title: string; summary: string }>;
  };

  if (!struct?.chapters?.length) throw new Error("Structure generation failed");

  const description = struct.description || "";
  const chapterDefs = struct.chapters.slice(0, 5);

  // Step 2: content for each chapter (sequential, no delay)
  const chapters: Array<{ title: string; content: string; summary: string }> = [];
  for (const ch of chapterDefs) {
    const contentCompletion = await withRetry(() =>
      zai.chat.completions.create({
        messages: [
          {
            role: "assistant",
            content: [
              "Expert pédagogue. Écris le contenu d'un chapitre en Markdown.",
              langNote,
              "- 100-150 mots MAX",
              "- ## pour 2 sous-titres, - pour listes, ** pour gras",
              "- Inclus un exemple court",
              "- UNIQUEMENT le texte Markdown, sans guillemets, sans backticks",
            ].join("\n"),
          },
          {
            role: "user",
            content: `Cours: ${title}\nChapitre: ${ch.title}\nRésumé: ${ch.summary}\n\nÉcris le contenu.`,
          },
        ],
        thinking: { type: "disabled" },
      })
    );

    let content = contentCompletion.choices[0]?.message?.content || "";
    content = content.trim();
    if (content.startsWith("```")) {
      const lines = content.split("\n");
      content = lines.slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined).join("\n").trim();
    }

    chapters.push({ title: ch.title, content, summary: ch.summary || "" });
  }

  return { description, chapters };
}

/* ── Main handler ────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 1, courseLang = "fr" } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const zai = await ZAI.create();

    // Try single call first (fastest, ~8-10s)
    let result = await generateSingleCall(zai, title, courseLang, level, sourceLinks);

    // Fallback to 2-step if we got too few chapters
    if (!result || result.chapters.length < 3) {
      console.log(`Single call got ${result?.chapters.length || 0} chapters, falling back to 2-step...`);
      result = await generateTwoStep(zai, title, courseLang, level, sourceLinks);
    }

    if (!result || result.chapters.length === 0) {
      throw new Error("L'IA n'a pas pu générer un cours valide. Réessaie.");
    }

    // Save to database
    const course = await db.course.create({
      data: {
        title: title.trim(),
        description: result.description,
        sourceLinks: JSON.stringify(sourceLinks),
        chapters: {
          create: result.chapters.map((ch, idx) => ({
            title: ch.title,
            content: ch.content,
            summary: ch.summary,
            order: idx + 1,
          })),
        },
      },
      include: { chapters: true },
    });

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        sourceLinks: JSON.parse(course.sourceLinks),
        createdAt: course.createdAt,
        chapters: course.chapters
          .sort((a, b) => a.order - b.order)
          .map((ch) => ({ id: ch.id, title: ch.title, content: ch.content, summary: ch.summary, order: ch.order })),
      },
    });
  } catch (error: unknown) {
    console.error("Course generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
