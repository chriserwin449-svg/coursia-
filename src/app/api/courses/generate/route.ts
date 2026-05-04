import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

/**
 * Parse JSON from AI response — handles code blocks, smart quotes,
 * trailing commas, and truncation recovery.
 */
function extractJSON(text: string): unknown {
  // Strip markdown code blocks if present
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();

  // Try direct parse
  const direct = tryParseJSON(cleaned);
  if (direct) return direct;

  // Truncation recovery: find the start and try to close properly
  const jsonStart = cleaned.indexOf("{");
  if (jsonStart !== -1) {
    let snippet = cleaned.slice(jsonStart);
    const parsed = tryParseJSON(snippet);
    if (parsed) return parsed;

    // Try aggressive truncation fix: remove trailing incomplete chapter
    // Find last complete "summary" field and close the JSON
    const lastSummaryEnd = snippet.lastIndexOf('"summary"');
    if (lastSummaryEnd !== -1) {
      // Find the end of this summary value (closing quote)
      const afterKey = snippet.slice(lastSummaryEnd + 10).trim();
      if (afterKey.startsWith(":")) {
        const valueStart = afterKey.indexOf('"');
        if (valueStart !== -1) {
          const valueRest = afterKey.slice(valueStart + 1);
          // Find closing quote (not escaped)
          let closeIdx = -1;
          for (let i = 0; i < valueRest.length; i++) {
            if (valueRest[i] === "\\") { i++; continue; }
            if (valueRest[i] === '"') { closeIdx = i; break; }
          }
          if (closeIdx !== -1) {
            // Count how many braces/brackets we need to close
            const partialJSON = snippet.slice(0, jsonStart + snippet.length - (afterKey.length - valueStart - closeIdx - 1));
            // Count open braces and brackets
            let openBrace = 0, openBracket = 0;
            for (const c of partialJSON) {
              if (c === "{") openBrace++;
              if (c === "}") openBrace--;
              if (c === "[") openBracket++;
              if (c === "]") openBracket--;
            }
            // Add missing closings
            let closing = "";
            // Close the current chapter object
            closing += "}";
            openBrace++;
            // Close remaining
            while (openBracket > 0) { closing += "]"; openBracket--; }
            while (openBrace > 0) { closing += "}"; openBrace--; }
            const fixed = partialJSON + closing;
            const recovered = tryParseJSON(fixed);
            if (recovered) return recovered;
          }
        }
      }
    }
  }

  return null;
}

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a function with exponential backoff on rate limits */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRateLimit = msg.includes("429") || msg.includes("rate limit") || msg.includes("Too many requests");
      if (isRateLimit && attempt < retries) {
        const delay = 3000 * (attempt + 1); // 3s, 6s, 9s
        console.warn(`Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

function tryParseJSON(raw: string): unknown {
  // Direct parse
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* try fixing */ }

  // Fix trailing commas
  try {
    const fixed = raw.replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(fixed);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* try next */ }

  // Fix smart quotes
  try {
    const fixed = raw
      .replace(/[\u201C\u201D]/g, "'")
      .replace(/[\u2018\u2019]/g, "'");
    const parsed = JSON.parse(fixed);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* try next */ }

  return null;
}

async function generateStructure(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  title: string,
  courseLang: string,
  level: number,
  sourceLinks: string[],
) {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = ["Débutant", "Intermédiaire", "Avancé"];

  const linksContext = sourceLinks.length > 0
    ? `\nRéférences: ${sourceLinks.join(", ")}`
    : "";

  const completion = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: [
            "Tu es un expert pédagogue qui crée des plans de cours structurés en JSON.",
            `Langue du cours: ${langLabels[courseLang] || "français"}.`,
            `Niveau: ${levelLabels[level] || "Intermédiaire"}.`,
            "",
            "Réponds UNIQUEMENT avec ce JSON valide, rien d'autre :",
            "{",
            '  "description": "Description du cours en 1 phrase",',
            '  "chapters": [',
            '    {"title": "Titre", "summary": "Résumé de 15-20 mots"}',
            "  ]",
            "}",
            "",
            "Règles STRICTES :",
            "- Exactement 5 chapitres",
            "- Titres progressifs et logiques",
            "- Utilise UNIQUEMENT des apostrophes, JAMAIS de guillemets dans les valeurs",
            "- Ne mets aucun texte avant ou après le JSON",
            linksContext,
          ].join("\n"),
        },
        {
          role: "user",
          content: `Crée le plan du cours sur: ${title}`,
        },
      ],
      thinking: { type: "disabled" },
    })
  );

  return completion.choices[0]?.message?.content || "";
}

async function generateChapterContent(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  title: string,
  courseLang: string,
  chapterTitle: string,
  chapterSummary: string,
) {
  const langInstructions: Record<string, string> = {
    fr: "Rédige en français. Utilise UNIQUEMENT des apostrophes, JAMAIS de guillemets doubles dans le texte.",
    en: "Write in English. Use ONLY apostrophes, NEVER double quotes in the text.",
  };

  const completion = await withRetry(() =>
    zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: [
            "Tu es un expert pédagogue. Tu écris le contenu d'un chapitre de cours en Markdown.",
            langInstructions[courseLang] || langInstructions.fr,
            "",
            "Règles STRICTES :",
            "- Contenu: 200-300 mots MAXIMUM",
            "- Utilise ## pour 2-3 sous-titres",
            "- Fais des listes avec -",
            "- Utilise ** pour le gras",
            "- Inclus un exemple concret",
            "- Réponds avec UNIQUEMENT le texte Markdown, sans guillemets, sans backticks",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Cours: ${title}\nChapitre: ${chapterTitle}\nRésumé attendu: ${chapterSummary}\n\nÉcris le contenu de ce chapitre.`,
        },
      ],
      thinking: { type: "disabled" },
    })
  );

  let content = completion.choices[0]?.message?.content || "";

  // Clean up: remove code blocks if the AI wrapped them
  content = content.trim();
  if (content.startsWith("```")) {
    const lines = content.split("\n");
    content = lines.slice(1, lines.length - (lines[lines.length - 1].trim() === "```" ? 1 : 0)).join("\n").trim();
  }

  return content;
}

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 1, courseLang = "fr" } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const zai = await ZAI.create();

    // ── Step 1: Generate course structure (titles + summaries) ──
    const structureText = await generateStructure(zai, title, courseLang, level, sourceLinks);
    const structure = extractJSON(structureText) as {
      description?: string;
      chapters?: Array<{ title: string; summary: string }>;
    };

    if (!structure?.chapters || !Array.isArray(structure.chapters) || structure.chapters.length === 0) {
      console.error("Failed to parse structure. Raw:", structureText.slice(0, 500));
      throw new Error("L'IA n'a pas pu générer la structure du cours. Réessaie.");
    }

    const description = structure.description || "";
    const chapters = structure.chapters.slice(0, 5); // max 5 chapters

    // ── Step 2: Generate content for each chapter (sequential with delay to avoid rate limits) ──
    const chaptersWithContent: Array<{ title: string; content: string; summary: string }> = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      // Wait 2 seconds between calls to avoid rate limits
      if (i > 0) await new Promise((r) => setTimeout(r, 2000));
      const content = await generateChapterContent(
        zai, title, courseLang, ch.title, ch.summary,
      );
      chaptersWithContent.push({
        title: ch.title,
        content,
        summary: ch.summary || "",
      });
    }

    // ── Step 3: Save to database ──
    const course = await db.course.create({
      data: {
        title: title.trim(),
        description,
        sourceLinks: JSON.stringify(sourceLinks),
        chapters: {
          create: chaptersWithContent.map((ch, idx) => ({
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
          .map((ch) => ({
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
