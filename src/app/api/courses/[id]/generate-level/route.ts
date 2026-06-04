import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { smartChatCompletion } from "@/lib/openai";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tryParseJSON(raw: string): unknown {
  try { return JSON.parse(raw); } catch { /* */ }
  try { return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")); } catch { /* */ }
  try { return JSON.parse(raw.replace(/[\u201C\u201D\u2018\u2019]/g, "'")); } catch { /* */ }
  return null;
}

function extractChapters(text: string): {
  description: string;
  chapters: Array<{ title: string; content: string; summary: string }>;
} | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;
  let depth = 0, lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") depth--;
  }
  const snippet = lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned.slice(firstBrace);
  const direct = tryParseJSON(snippet);
  if (direct) return validateChapters(direct);

  const regex = /\{"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"/g;
  let m: RegExpExecArray | null;
  const positions: number[] = [];
  while ((m = regex.exec(snippet)) !== null) positions.push(m.index);
  for (let i = positions.length; i >= 1; i--) {
    for (let j = 0; j < i; j++) {
      const remaining = snippet.slice(positions[j]);
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
      const endPos = positions[j] + summaryIdx + 9 + afterSummary.length - valRest.length + closeIdx + 1;
      const partial = snippet.slice(0, endPos);
      let ob = 0, osb = 0;
      for (const c of partial) {
        if (c === "{") ob++; if (c === "}") ob--;
        if (c === "[") osb++; if (c === "]") osb--;
      }
      let closing = "}"; ob++;
      while (osb > 0) { closing += "]"; osb--; }
      while (ob > 0) { closing += "}"; ob--; }
      const fixed = tryParseJSON(partial + closing);
      if (fixed) { const r = validateChapters(fixed); if (r && r.chapters.length >= Math.min(i, 3)) return r; }
    }
  }
  return null;
}

function validateChapters(data: unknown): {
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
    if (typeof c.title === "string" && c.title.trim() && typeof c.content === "string" && c.content.trim()) {
      chapters.push({ title: c.title.trim(), content: c.content.trim(), summary: typeof c.summary === "string" ? c.summary.trim() : "" });
    }
  }
  return chapters.length > 0 ? { description, chapters } : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { level: nextLevel } = await request.json();

    if (nextLevel === undefined || nextLevel < 0 || nextLevel > 2) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const course = await db.course.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { order: "asc" } },
        progress: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const currentMaxLevel = course.progress?.maxUnlockedLevel ?? 0;
    if (nextLevel <= currentMaxLevel) {
      return NextResponse.json({ error: "Level already unlocked" }, { status: 400 });
    }

    // Get course language from first chapter content
    const courseLang = course.chapters[0]?.content?.includes("##") ? "fr" : "fr";

    const levelLabels = [
      "Débutant (complet, accessible, exemples simples, bases fondamentales)",
      "Intermédiaire (approfondi, exemples pratiques, exercices de réflexion, cas d'usage réels)",
      "Avancé (expert, cas complexes, analyses critiques, liens entre concepts, maîtrise totale)"
    ];

    const langNote = "Tu DOIS rédiger l'intégralité du cours en français. Tous les titres, contenus, résumés — tout en français.";

    const existingSummaries = course.chapters
      .filter((ch) => ch.level < nextLevel)
      .map((ch) => `- ${ch.title}: ${ch.summary}`)
      .join("\n");

    const previousLevelContext = existingSummaries
      ? `\n\nCONTEXTE DU COURS — Niveaux précédents déjà étudiés:\n${existingSummaries}\n\nIMPORTANT: Le nouveau niveau doit BUILD sur ces connaissances. Ne pas répéter le contenu précédent. Approfondir et complexifier.`
      : "";

    const completion = await smartChatCompletion([
      {
        role: "system",
        content: [
          "Tu es Coursia AI, un professeur IA exceptionnel.",
          "",
          "MISSION : Génère 4-6 chapitres pour le niveau " + nextLevel + " du cours : " + course.title,
          "",
          "STYLE : Dynamique, humain, captivant, jamais robotique.",
          "",
          `Level: ${levelLabels[nextLevel]}`,
          `Language: français`,
          `- ${langNote}`,
          "",
          "STRUCTURE:",
          "- Chaque chapitre: minimum 250 mots, au moins 2 sous-chapitres (## en Markdown)",
          "- Utilise: ## sous-chapitres, - listes, ** gras, > citations",
          "- Ne JAMAIS utiliser de guillemets doubles dans les valeurs JSON",
          "",
          previousLevelContext,
          "",
          "RESPOND ONLY with valid JSON:",
          '{"description":"Description","chapters":[{"title":"Title","content":"## Sub1\\nContent\\n\\n## Sub2\\nContent","summary":"Summary"}]}',
        ].join("\n"),
      },
      { role: "user", content: `Génère les chapitres du niveau ${nextLevel} pour le cours : ${course.title}` },
    ], { maxTokens: 8192 });

    const text = completion.content || "";
    const result = extractChapters(text);

    if (!result || result.chapters.length === 0) {
      return NextResponse.json({ error: "Failed to generate level content" }, { status: 500 });
    }

    // Get current max chapter order
    const maxOrder = course.chapters.reduce((max, ch) => Math.max(max, ch.order), 0);

    // Create new chapters for this level
    const newChapters = await db.chapter.createMany({
      data: result.chapters.map((ch, idx) => ({
        title: ch.title,
        content: ch.content,
        summary: ch.summary,
        order: maxOrder + idx + 1,
        level: nextLevel,
        courseId: id,
      })),
    });

    // Update CourseProgress maxUnlockedLevel
    await db.courseProgress.upsert({
      where: { courseId: id },
      create: { courseId: id, maxUnlockedLevel: nextLevel },
      update: { maxUnlockedLevel: nextLevel },
    });

    // Fetch the newly created chapters with proper order
    const createdChapters = await db.chapter.findMany({
      where: { courseId: id, level: nextLevel },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      success: true,
      level: nextLevel,
      description: result.description,
      chaptersCreated: newChapters.count,
      chapters: createdChapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        summary: ch.summary,
        order: ch.order,
        level: ch.level,
      })),
    });
  } catch (error) {
    console.error("[generate-level] Error:", error);
    return NextResponse.json({ error: "Failed to generate level" }, { status: 500 });
  }
}
