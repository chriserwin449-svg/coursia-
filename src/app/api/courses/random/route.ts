import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Tu es un créateur de sujets d'apprentissage. Génère un sujet de cours aléatoire et intéressant.
Tu DOIS répondre UNIQUEMENT avec un JSON valide contenant :
{
  "title": "Titre du sujet de cours",
  "description": "Pourquoi ce sujet est intéressant à apprendre"
}

Le sujet doit être varié et couvrir différents domaines : sciences, technologie, arts, histoire, philosophie, compétences pratiques, etc.
Sois créatif et propose des sujets originaux.
N'utilise pas de guillemets doubles dans les valeurs des champs.`
        },
        {
          role: "user",
          content: "Propose un sujet de cours aléatoire et original que je pourrais apprendre.",
        },
      ],
      thinking: { type: "disabled" },
    });

    const responseText = completion.choices[0]?.message?.content || "";

    // Robust JSON extraction
    let topic: unknown = null;

    // Strategy 1: code block
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try { topic = JSON.parse(codeBlockMatch[1].trim()); } catch { /* next */ }
    }

    // Strategy 2: balanced braces
    if (!topic) {
      const jsonStart = responseText.indexOf("{");
      if (jsonStart !== -1) {
        let depth = 0;
        let end = -1;
        for (let i = jsonStart; i < responseText.length; i++) {
          if (responseText[i] === "{") depth++;
          if (responseText[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
        }
        if (end !== -1) {
          try { topic = JSON.parse(responseText.slice(jsonStart, end)); } catch { /* give up */ }
        }
      }
    }

    if (!topic || typeof topic !== "object" || !("title" in topic)) {
      throw new Error("Failed to parse random topic");
    }

    return NextResponse.json({ success: true, topic });
  } catch (error: unknown) {
    console.error("Random course error:", error);
    return NextResponse.json({ error: "Failed to generate random topic" }, { status: 500 });
  }
}
