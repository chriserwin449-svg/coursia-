import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un créateur de sujets d'apprentissage. Génère un sujet de cours aléatoire et intéressant.
Tu DOIS répondre UNIQUEMENT avec un JSON valide contenant :
{
  "title": "Titre du sujet de cours",
  "description": "Pourquoi ce sujet est intéressant à apprendre"
}

Le sujet doit être varié et couvrir différents domaines : sciences, technologie, arts, histoire, philosophie, compétences pratiques, etc.
Sois créatif et propose des sujets originaux.`
        },
        {
          role: "user",
          content: "Propose un sujet de cours aléatoire et original que je pourrais apprendre."
        },
      ],
      thinking: { type: "disabled" },
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Failed to parse random topic");
    }

    const topic = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ success: true, topic });
  } catch (error: unknown) {
    console.error("Random course error:", error);
    return NextResponse.json({ error: "Failed to generate random topic" }, { status: 500 });
  }
}
