import { NextRequest, NextResponse } from "next/server";
import { smartChatCompletion } from "@/lib/openai";

// In-memory cache to avoid repeating recent topics
const recentTopics: string[] = [];
const MAX_CACHE = 50;

export async function POST(request: NextRequest) {
  try {
    const cacheHint = recentTopics.length > 0
      ? `\n\nSUJETS DÉJÀ PROPOSÉS (NE PROPOSE AUCUN DE CES SUJETS) :\n${recentTopics.slice(-20).map(t => `- ${t}`).join("\n")}`
      : "";

    const completion = await smartChatCompletion([
      {
        role: "system",
        content: `Tu es un créateur de sujets d'apprentissage très créatif. Génère un sujet de cours aléatoire et fascinant.

Tu DOIS répondre UNIQUEMENT avec un JSON valide contenant :
{
  "title": "Titre du sujet de cours",
  "description": "Pourquoi ce sujet est intéressant à apprendre"
}

RÈGLES STRICTES :
- Le sujet doit être UNIQUE et ORIGINAL — jamais un sujet générique ou évident.
- Varie entre des domaines très différents : sciences, technologie, arts, histoire, philosophie, compétences pratiques, psychologie, nature, espace, cultures du monde, énigmes historiques, technologies émergentes...
- Sois SURPRENANT et INATTENDU — propose des sujets que la plupart des gens ne connaissent pas.
- Privilégie les sujets NICHE et fascinants plutôt que les sujets populaires.
${cacheHint}
N'utilise pas de guillemets doubles dans les valeurs des champs.`,
      },
      {
        role: "user",
        content: "Propose un sujet de cours aléatoire, original et fascinant que je n'ai jamais entendu auparavant.",
      },
    ]);

    const responseText = completion.content || "";

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

    const t = topic as { title: string; description: string };

    // Add to recent topics cache
    recentTopics.push(t.title);
    if (recentTopics.length > MAX_CACHE) recentTopics.shift();

    return NextResponse.json({ success: true, topic: t });
  } catch (error: unknown) {
    console.error("Random course error:", error);
    return NextResponse.json({ error: "Failed to generate random topic" }, { status: 500 });
  }
}
