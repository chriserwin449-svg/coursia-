import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

/**
 * Robustly extract and parse JSON from AI response text.
 * The AI often wraps JSON in ```json ... ``` code blocks,
 * and the markdown content may contain backticks, braces, or quotes.
 */
function extractJSON(text: string): unknown {
  // Strategy 1: Find ```json blocks and try each one
  const blockRegex = /```json\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  const blocks: string[] = [];
  while ((match = blockRegex.exec(text)) !== null) {
    blocks.push(match[1]);
  }

  // Try the longest block first (most likely the complete JSON)
  blocks.sort((a, b) => b.length - a.length);
  for (const block of blocks) {
    const result = tryParseJSON(block.trim());
    if (result) return result;
  }

  // Strategy 2: Try to parse the entire response as JSON
  const result = tryParseJSON(text.trim());
  if (result) return result;

  // Strategy 3: Try to find JSON by looking for the top-level structure
  // Find the position of "description" key which is the first field
  const descIdx = text.indexOf('"description"');
  if (descIdx !== -1) {
    // Find the opening { before it
    let start = descIdx;
    while (start > 0 && text[start] !== "{") start--;
    if (text[start] === "{") {
      // Find matching closing brace using balanced counting
      let depth = 0;
      let end = -1;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        if (text[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      if (end !== -1) {
        const result = tryParseJSON(text.slice(start, end));
        if (result) return result;
      }
    }
  }

  return null;
}

function tryParseJSON(raw: string): unknown {
  // Direct parse
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* try fixing */ }

  // Try fixing common AI JSON issues:
  // 1. Trailing commas before } or ]
  try {
    const fixed = raw.replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(fixed);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* try next */ }

  // 2. Replace smart quotes with regular ones
  try {
    const fixed = raw
      .replace(/[\u201C\u201D]/g, "'")
      .replace(/[\u2018\u2019]/g, "'");
    const parsed = JSON.parse(fixed);
    if (parsed && typeof parsed === "object") return parsed;
  } catch { /* try next */ }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 1, courseLang = "fr" } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const zai = await ZAI.create();

    const linksContext = sourceLinks.length > 0
      ? `\nLiens de référence: ${sourceLinks.join(", ")}`
      : "";

    const levelLabels = ["Débutant", "Intermédiaire", "Avancé"];
    const langLabels: Record<string, string> = { fr: "français", en: "english" };

    const systemPrompt = [
      "Tu es un expert pédagogue. Tu crées des cours structurés en JSON.",
      `Le cours doit être rédigé entièrement en ${langLabels[courseLang] || "français"}.`,
      `Niveau: ${levelLabels[level] || "Intermédiaire"}.`,
      "",
      "FORMAT OBLIGATOIRE — réponds UNIQUEMENT avec ce JSON, ni plus ni moins :",
      "{",
      '  "description": "Description courte du cours",',
      '  "chapters": [',
      '    {',
      '      "title": "Titre du chapitre",',
      '      "content": "Contenu en Markdown. Au moins 300 mots. Utilise ## pour les sous-titres. Utilise UNIQUEMENT des apostrophes dans le texte, JAMAIS de guillemets. Fais des listes avec -. Mettre du **gras** avec **.",',
      '      "summary": "Résumé court du chapitre"',
      "    }",
      "  ]",
      "}",
      "",
      "Règles:",
      "- Crée entre 5 et 7 chapitres",
      "- Chaque chapitre: au moins 300 mots de contenu",
      "- Chapitres progressifs et logiquement ordonnés",
      "- Inclus des exemples concrets",
      "- DANS LES VALEURS JSON: utilise UNIQUEMENT des apostrophes (') et JAMAIS de guillemets doubles (\")",
      "- Ne mets aucun texte avant ou après le JSON" + linksContext,
    ].join("\n");

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Crée un cours complet sur: ${title}` },
      ],
      thinking: { type: "disabled" },
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const courseData = extractJSON(responseText);

    if (!courseData || typeof courseData !== "object") {
      console.error("Failed to parse course JSON. Raw length:", responseText.length);
      console.error("First 500:", responseText.slice(0, 500));
      console.error("Last 200:", responseText.slice(-200));
      throw new Error("L'IA n'a pas pu générer un cours valide. Réessaie.");
    }

    const data = courseData as { description?: string; chapters?: Array<{ title: string; content: string; summary: string }> };

    if (!data.chapters || !Array.isArray(data.chapters) || data.chapters.length === 0) {
      throw new Error("Invalid course structure - missing chapters");
    }

    for (const ch of data.chapters) {
      if (!ch.title || !ch.content) {
        throw new Error("Invalid chapter - missing title or content");
      }
    }

    const course = await db.course.create({
      data: {
        title: title.trim(),
        description: data.description || "",
        sourceLinks: JSON.stringify(sourceLinks),
        chapters: {
          create: data.chapters.map(
            (ch, idx) => ({
              title: ch.title,
              content: ch.content,
              summary: ch.summary || "",
              order: idx + 1,
            })
          ),
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
