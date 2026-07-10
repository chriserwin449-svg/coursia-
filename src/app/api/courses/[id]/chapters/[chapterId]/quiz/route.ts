import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smartChatCompletion } from "@/lib/openai";
import { calculateFlameEarned } from "@/lib/flames";
import { getUserIdFromRequest } from "@/lib/get-user-id";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;
    const body = await request.json().catch(() => ({}));
    const { regenerate = false } = body as { regenerate?: boolean };

    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { course: true, quiz: true },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    // If regenerate is true, delete existing quiz to force a new one
    if (regenerate && chapter.quiz) {
      await db.quiz.delete({ where: { id: chapter.quiz.id } });
    }

    // Re-fetch after possible delete
    const chapterFresh = chapter.quiz && !regenerate
      ? chapter
      : await db.chapter.findUnique({
          where: { id: chapterId },
          include: { course: true, quiz: true },
        });

    if (chapterFresh?.quiz) {
      return NextResponse.json({
        success: true,
        quiz: { id: chapterFresh.quiz.id, questions: JSON.parse(chapterFresh.quiz.questions) },
      });
    }

    const completion = await smartChatCompletion([
      {
        role: "system",
        content: `Tu es un expert en évaluation pédagogique. Crée un quiz de 5 questions basé sur le contenu du chapitre donné.

OBJECTIF : Tester la COMPRÉHENSION réelle de l'utilisateur, pas sa mémoire.

Tu DOIS répondre UNIQUEMENT avec un JSON valide :
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Explication pédagogique : pourquoi la bonne réponse est correcte et pourquoi les autres sont fausses. 2-3 phrases claires et utiles."
    }
  ]
}

Règles STRICTES :
- Exactement 5 questions
- Chaque question a exactement 4 options
- correctIndex est l'index (0-3) de la bonne réponse
- Chaque question DOIT avoir un champ "explanation" avec une explication pédagogique claire
- L'explication doit expliquer pourquoi la bonne réponse est correcte ET pourquoi les autres options sont incorrectes
- Les options INCORRECTES doivent être plausibles (pas évidemment fausses)
- Varie les types de questions :
  - Q1: Fait clé du chapitre (test de base)
  - Q2: Application concrète ('Dans quelle situation...')
  - Q3: Compréhension d'un concept ('Pourquoi est-ce que...')
  - Q4: Identification d'une erreur courante ('Laquelle de ces affirmations est FAUSSE ?')
  - Q5: Synthèse ou cas pratique ('Si X arrive, que devrait-on faire ?')
- Les questions doivent couvrir DIFFÉRENTES parties du chapitre, pas toutes le même concept
- Utilise le même langage que le contenu du chapitre (français ou anglais)`,
      },
      {
        role: "user",
        content: `Crée un quiz pour ce chapitre :\n\nTitre: ${chapter.title}\n\nContenu:\n${chapter.content}`,
      },
    ]);

    const responseText = completion.content || "";

    // Robust JSON extraction
    let quizData: unknown = null;

    // Strategy 1: Extract from ```json code block
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try { quizData = JSON.parse(codeBlockMatch[1].trim()); } catch { /* next */ }
    }

    // Strategy 2: Find balanced JSON object
    if (!quizData) {
      const jsonStart = responseText.indexOf("{");
      if (jsonStart !== -1) {
        let depth = 0;
        let end = -1;
        for (let i = jsonStart; i < responseText.length; i++) {
          if (responseText[i] === "{") depth++;
          if (responseText[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end !== -1) {
          try { quizData = JSON.parse(responseText.slice(jsonStart, end)); } catch { /* give up */ }
        }
      }
    }

    if (!quizData) {
      throw new Error("Failed to parse quiz");
    }

    const quizDataValidated = quizData as { questions?: unknown[] };
    if (!quizDataValidated.questions || !Array.isArray(quizDataValidated.questions)) {
      throw new Error("Invalid quiz structure");
    }

    const quiz = await db.quiz.create({
      data: {
        chapterId: chapter.id,
        questions: JSON.stringify(quizDataValidated.questions),
      },
    });

    return NextResponse.json({
      success: true,
      quiz: { id: quiz.id, questions: quizDataValidated.questions },
    });
  } catch (error: unknown) {
    console.error("Quiz generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate quiz";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;
    const { answers } = await request.json();

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "answers must be an array" }, { status: 400 });
    }

    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { quiz: true, progress: true },
    });

    if (!chapter || !chapter.quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    let questions: { correctIndex: number }[];
    try {
      questions = JSON.parse(chapter.quiz.questions);
    } catch {
      return NextResponse.json({ error: "Malformed quiz data" }, { status: 500 });
    }
    let correctCount = 0;

    questions.forEach((q: { correctIndex: number }, idx: number) => {
      if (answers[idx] === q.correctIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 60;

    const progress = await db.chapterProgress.upsert({
      where: { chapterId },
      create: {
        chapterId,
        completed: passed,
        score,
        completedAt: passed ? new Date() : null,
      },
      update: {
        completed: passed,
        score: Math.max(score, chapter.progress?.score || 0),
        completedAt: passed && !chapter.progress?.completed ? new Date() : chapter.progress?.completedAt,
      },
    });

    // Award flame points if quiz passed and not already awarded
    if (passed && !progress.flameAwarded) {
      const userId = getUserIdFromRequest(request);
      const flamePoints = calculateFlameEarned(score);
      const settingsId = userId || "main";
      await db.appSettings.upsert({
        where: { id: settingsId },
        create: { id: settingsId, flamePoints },
        update: { flamePoints: { increment: flamePoints } },
      });
      await db.flameTransaction.create({
        data: {
          amount: flamePoints,
          reason: "chapter_complete",
          courseId: chapter.courseId,
          chapterId,
          userId: userId || null,
        },
      });
      await db.chapterProgress.update({
        where: { chapterId },
        data: { flameAwarded: true },
      });
    }

    return NextResponse.json({
      success: true,
      score,
      correct: correctCount,
      total: questions.length,
      passed,
    });
  } catch (error) {
    console.error("Quiz submit error:", error);
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 });
  }
}
