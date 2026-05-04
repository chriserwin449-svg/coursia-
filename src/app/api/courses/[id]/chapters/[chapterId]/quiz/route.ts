import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;

    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { course: true },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    if (chapter.quiz) {
      return NextResponse.json({
        success: true,
        quiz: { id: chapter.quiz.id, questions: JSON.parse(chapter.quiz.questions) },
      });
    }

    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un créateur de quiz pédagogiques. Crée un quiz de 5 questions en français basé sur le contenu du chapitre donné.
Tu DOIS répondre UNIQUEMENT avec un JSON valide contenant :
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}

Règles :
- Exactement 5 questions
- Chaque question a exactement 4 options
- correctIndex est l'index (0-3) de la bonne réponse
- Les questions doivent tester la compréhension réelle du contenu
- Varie le type de questions (factual, application, analyse)`
        },
        {
          role: "user",
          content: `Crée un quiz pour ce chapitre :\n\nTitre: ${chapter.title}\n\nContenu:\n${chapter.content}`
        },
      ],
      thinking: { type: "disabled" },
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Failed to parse quiz");
    }

    const quizData = JSON.parse(jsonMatch[0]);

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error("Invalid quiz structure");
    }

    const quiz = await db.quiz.create({
      data: {
        chapterId: chapter.id,
        questions: JSON.stringify(quizData.questions),
      },
    });

    return NextResponse.json({
      success: true,
      quiz: { id: quiz.id, questions: quizData.questions },
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

    const chapter = await db.chapter.findUnique({
      where: { id: chapterId },
      include: { quiz: true, progress: true },
    });

    if (!chapter || !chapter.quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questions = JSON.parse(chapter.quiz.questions);
    let correctCount = 0;

    questions.forEach((q: { correctIndex: number }, idx: number) => {
      if (answers[idx] === q.correctIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 60;

    await db.chapterProgress.upsert({
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
