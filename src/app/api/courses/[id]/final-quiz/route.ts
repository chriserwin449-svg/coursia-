import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { calculateCourseCompletionBonus } from "@/lib/flames";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: { orderBy: { order: "asc" } },
        finalQuiz: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Return existing quiz if already generated
    if (course.finalQuiz) {
      return NextResponse.json({
        success: true,
        quiz: { id: course.finalQuiz.id, questions: JSON.parse(course.finalQuiz.questions) },
      });
    }

    // Generate new final quiz covering all chapters
    const zai = await ZAI.create();

    const chapterSummaries = course.chapters
      .map((ch, i) => `Chapitre ${i + 1}: ${ch.title}\n${ch.content.slice(0, 300)}`)
      .join("\n\n");

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Tu es un créateur de quiz pédagogiques. Crée un quiz FINAL de 8 questions basé sur l'ensemble du cours donné.
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
- Exactement 8 questions couvrant tous les chapitres du cours
- Chaque question a exactement 4 options
- correctIndex est l'index (0-3) de la bonne réponse
- Les questions doivent tester la compréhension globale du cours
- Varie le type de questions (factual, application, analyse, synthèse)
- Inclue au moins une question de synthèse croisant plusieurs chapitres`
        },
        {
          role: "user",
          content: `Crée le quiz final pour ce cours :\n\nTitre: ${course.title}\nDescription: ${course.description}\n\nChapitres:\n${chapterSummaries}`
        },
      ],
      thinking: { type: "disabled" },
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Robust JSON extraction
    let quizData: unknown = null;

    // Strategy 1: code block
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try { quizData = JSON.parse(codeBlockMatch[1].trim()); } catch { /* next */ }
    }

    // Strategy 2: balanced braces
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
      throw new Error("Failed to parse final quiz");
    }

    const quizDataValidated = quizData as { questions?: unknown[] };
    if (!quizDataValidated.questions || !Array.isArray(quizDataValidated.questions)) {
      throw new Error("Invalid quiz structure");
    }

    const quiz = await db.courseQuiz.create({
      data: {
        courseId: course.id,
        questions: JSON.stringify(quizDataValidated.questions),
      },
    });

    return NextResponse.json({
      success: true,
      quiz: { id: quiz.id, questions: quizDataValidated.questions },
    });
  } catch (error: unknown) {
    console.error("Final quiz generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate final quiz";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const { answers } = await request.json();

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { finalQuiz: true, progress: true },
    });

    if (!course || !course.finalQuiz) {
      return NextResponse.json({ error: "Final quiz not found" }, { status: 404 });
    }

    const questions = JSON.parse(course.finalQuiz.questions);
    let correctCount = 0;

    questions.forEach((q: { correctIndex: number }, idx: number) => {
      if (answers[idx] === q.correctIndex) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= 60;

    const courseProgress = await db.courseProgress.upsert({
      where: { courseId },
      create: {
        courseId,
        completed: passed,
        score,
        passedAt: passed ? new Date() : null,
      },
      update: {
        completed: passed,
        score: Math.max(score, course.progress?.score || 0),
        passedAt: passed && !course.progress?.completed ? new Date() : course.progress?.passedAt,
      },
    });

    // Award bonus flame points on course completion (first pass only)
    // Harder earning: scaled bonus based on score
    if (passed && !courseProgress.flameAwarded) {
      const bonusPoints = calculateCourseCompletionBonus(score);
      await db.appSettings.upsert({
        where: { id: "main" },
        create: { id: "main", flamePoints: bonusPoints },
        update: { flamePoints: { increment: bonusPoints } },
      });
      await db.flameTransaction.create({
        data: {
          amount: bonusPoints,
          reason: "course_complete",
          courseId,
        },
      });
      await db.courseProgress.update({
        where: { courseId },
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
    console.error("Final quiz submit error:", error);
    return NextResponse.json({ error: "Failed to submit final quiz" }, { status: 500 });
  }
}
