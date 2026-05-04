import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 1, courseLang = "fr" } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const zai = await ZAI.create();

    const linksContext = sourceLinks.length > 0
      ? `\n\nVoici des liens de référence que l'utilisateur veut intégrer au cours :\n${sourceLinks.map((l: string) => `- ${l}`).join("\n")}`
      : "";

    const levelLabels = ["Débutant", "Intermédiaire", "Avancé"];
    const langLabels: Record<string, string> = { fr: "français", en: "anglais" };

    const systemPrompt = `Tu es un expert pédagogue et créateur de cours. Tu dois créer un cours complet, bien structuré et engaging sur le sujet donné.
Le cours doit être rédigé entièrement en ${langLabels[courseLang] || "français"}.
Le niveau de l'apprenant est : ${levelLabels[level] || "Intermédiaire"}. Adapte la complexité, le vocabulaire et les explications en conséquence.
Tu DOIS répondre UNIQUEMENT en JSON valide, sans aucun texte avant ou après.
Le format JSON doit être exactement :
{
  "description": "Une brève description du cours (1-2 phrases)",
  "chapters": [
    {
      "title": "Titre du chapitre",
      "content": "Le contenu complet du chapitre en Markdown, avec des titres (##), des listes, du gras, etc. Le contenu doit être riche, détaillé et facile à comprendre. Inclus des exemples pratiques quand c'est possible. Chaque chapitre doit contenir au moins 300 mots.",
      "summary": "Un résumé de 2-3 phrases du chapitre"
    }
  ]
}

Règles :
- Crée entre 5 et 8 chapitres selon la complexité du sujet
- Chaque chapitre doit être progressif et construire sur les précédents
- Utilise du Markdown pour structurer le contenu
- Les chapitres doivent être ordonnés logiquement
- Inclus des exemples concrets et pratiques
- Adapte la complexité au sujet${linksContext}`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt },
        { role: "user", content: `Crée un cours complet sur : ${title}` },
      ],
      thinking: { type: "disabled" },
    });

    let responseText = completion.choices[0]?.message?.content || "";
    
    // Clean up response - extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const courseData = JSON.parse(jsonMatch[0]);

    if (!courseData.chapters || !Array.isArray(courseData.chapters) || courseData.chapters.length === 0) {
      throw new Error("Invalid course structure");
    }

    // Create course in database
    const course = await db.course.create({
      data: {
        title: title.trim(),
        description: courseData.description || "",
        sourceLinks: JSON.stringify(sourceLinks),
        chapters: {
          create: courseData.chapters.map(
            (ch: { title: string; content: string; summary: string }, idx: number) => ({
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
