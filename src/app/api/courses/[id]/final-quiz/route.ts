import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smartChatCompletion } from "@/lib/openai";
import { calculateCourseCompletionBonus } from "@/lib/flames";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { getCurrentFlameType } from "@/lib/flames";
import { createNotification } from "@/lib/create-notification";

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
    const chapterSummaries = course.chapters
      .map((ch, i) => `Chapitre ${i + 1}: ${ch.title}\n${ch.content.slice(0, 300)}`)
      .join("\n\n");

    const completion = await smartChatCompletion([
      {
        role: "system",
        content: `Tu es un expert en évaluation pédagogique. Crée un quiz FINAL de 10 questions basé sur l'ensemble du cours donné.

OBJECTIF : Tester la compréhension GLOBALE et la capacité à appliquer les connaissances.

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
- Exactement 10 questions couvrant TOUS les chapitres du cours
- Chaque question a exactement 4 options
- correctIndex est l'index (0-3) de la bonne réponse
- Chaque question DOIT avoir un champ "explanation" avec une explication pédagogique claire
- L'explication doit expliquer pourquoi la bonne réponse est correcte ET pourquoi les autres options sont incorrectes
- Les options INCORRECTES doivent être plausibles et réalistes
- Répartition obligatoire :
  - 3 questions factuelles (concepts clés)
  - 3 questions d'application ("Dans quelle situation...")
  - 2 questions d'analyse ("Pourquoi est-ce que...", "Quelle est la différence entre...")
  - 1 question piège (erreur courante à identifier)
  - 1 question de synthèse (croisant plusieurs chapitres)
- Les questions doivent tester la compréhension PROFONDE, pas la mémoire superficielle
- Utilise le même langage que le contenu du cours (français ou anglais)`,
      },
      {
        role: "user",
        content: `Crée le quiz final pour ce cours :\n\nTitre: ${course.title}\nDescription: ${course.description}\n\nChapitres:\n${chapterSummaries}`,
      },
    ]);

    const responseText = completion.content || "";

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
    const body = await request.json() as { answers?: unknown[]; userId?: string };
    const { answers } = body;

    if (!Array.isArray(answers)) {
      return NextResponse.json({ error: "answers must be an array" }, { status: 400 });
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: { finalQuiz: true, progress: true },
    });

    if (!course || !course.finalQuiz) {
      return NextResponse.json({ error: "Final quiz not found" }, { status: 404 });
    }

    let questions: { correctIndex: number }[];
    try {
      questions = JSON.parse(course.finalQuiz.questions);
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
      const userId = getUserIdFromRequest(request, body.userId);
      if (userId) {
        const bonusPoints = calculateCourseCompletionBonus(score);
        const settingsId = userId;
        await db.appSettings.upsert({
          where: { id: settingsId },
          create: { id: settingsId, flamePoints: bonusPoints },
          update: { flamePoints: { increment: bonusPoints } },
        });
        await db.flameTransaction.create({
          data: {
            amount: bonusPoints,
            reason: "course_complete",
            courseId,
            userId,
          },
        });
        await db.courseProgress.update({
          where: { courseId },
          data: { flameAwarded: true },
        });

        // Check for flame tier upgrade
        const updatedSettings = await db.appSettings.findUnique({ where: { id: userId } });
        if (updatedSettings) {
          const prevType = getCurrentFlameType(updatedSettings.flamePoints - bonusPoints);
          const newType = getCurrentFlameType(updatedSettings.flamePoints);
          if (prevType.id !== newType.id) {
            await createNotification({
              userId,
              type: "flame_tier_up",
              title: `${newType.emoji} ${newType.name}`,
              message: `You reached ${updatedSettings.flamePoints} flame points!`,
              data: { points: updatedSettings.flamePoints, tierId: newType.id },
            });
          }
        }
      }
    }

    // Check for badge earned (course completion crossed a threshold)
    if (passed && userId) {
      try {
        const { BADGE_DEFINITIONS } = await import("@/lib/badges");
        const completedCount = await db.courseProgress.count({
          where: { completed: true },
        });
        const prevCount = completedCount - 1;
        for (const badge of BADGE_DEFINITIONS) {
          if (prevCount < badge.threshold && completedCount >= badge.threshold) {
            await createNotification({
              userId,
              type: "badge_earned",
              title: `${badge.emoji} ${badge.name}`,
              message: badge.descriptionEn,
              data: { badgeName: badge.name, completedCourses: completedCount },
            });
          }
        }
      } catch { /* ignore badge check */ }
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
