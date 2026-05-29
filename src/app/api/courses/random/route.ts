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
        content: `Tu es un expert en création de titres de cours premium. Ton rôle est de générer des sujets de cours irrésistibles, ultra-spécifiques et fascinants.

Tu DOIS répondre UNIQUEMENT avec un JSON valide contenant :
{
  "title": "Titre premium du cours",
  "description": "Pourquoi ce sujet est captivant et ce que l'utilisateur va apprendre"
}

RÈGLES STRICTES POUR LES TITRES :

1. SPÉCIFICITÉ OBLIGATOIRE
- JAMAIS de titres génériques comme 'Les Réseaux Sociaux', 'La Psychologie', 'L'Histoire de France'
- TOUJOURS des titres ultra-spécifiques et niche comme :
  - 'Comment les algorithmes de TikTok manipulent ton attention en 7 secondes'
  - 'Pourquoi ton cerveau choisit la mauvaise décision quand tu es fatigué'
  - 'Les 5 erreurs mentales qui te font perdre de l'argent sans le savoir'
  - 'Comment les sons subliminaux dans les films te font ressentir des émotions fausses'
  - 'Ce que les chefs étoilés savent sur la psychologie du goût que tu ignores'
  - 'Pourquoi les gens les plus intelligents prennent parfois les pires décisions'

2. FORMAT PREMIUM
- Le titre doit ressembler à un cours à 200€ sur une plateforme premium
- Utilise des chiffres concrets quand c'est possible (7 secrets, 3 erreurs, 5 techniques)
- Crée un 'curiosity gap' — le titre doit intriguer sans tout révéler
- Le titre doit donner envie de cliquer IMMÉDIATEMENT
- Il doit sonner comme la réponse à un problème que le lecteur a sans le savoir

3. EFFET IRRESISTIBLE
- Le titre doit provoquer une réaction : 'Ah bon ? Vraiment ?'
- Utilise des mots qui créent de l'urgence ou de la curiosité
- Ajoute un angle inattendu ou contre-intuitif
- Le lecteur doit se dire : 'Je DOIS savoir ça'

4. VARIÉTÉ DES DOMAINES
Alterne entre des domaines très variés :
- Sciences et découvertes surprenantes
- Psychologie humaine et comportements cachés
- Technologies émergentes et leurs impacts
- Arts, créativité et design
- Histoire et mystères non résolus
- Business, marketing et économie comportementale
- Santé, cerveau et bien-être
- Énigmes, paradoxes et phénomènes étranges
- Sport, performance et biomechanique
- Cuisine, nutrition et science des saveurs
- Espace, astronomie et physique quantique
- Cultures du monde et anthropologie
- Jeux vidéo, game design et addiction
- Argent, investissement et finance personnelle
- Relations humaines et communication

5. ORIGINALITÉ MAXIMALE
- Chaque titre doit être unique et inédit
- Pense à ce qui ferait un excellent tweet viral ou un titre YouTube à millions de vues
- Combinais des idées de domaines différents pour créer quelque chose de nouveau
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
