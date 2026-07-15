import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smartChatCompletion } from "@/lib/openai";

// Fallback topics when AI is unavailable
const fallbackTopics = [
  { title: "Comment les algorithmes de TikTok manipulent ton attention", description: "Décryptage de l'engagement addictif" },
  { title: "Pourquoi ton cerveau choisit la mauvaise décision quand tu es fatigué", description: "La science de la fatigue décisionnelle" },
  { title: "Les secrets de la négociation utilisés par les agents du FBI", description: "Techniques de communication avancée" },
  { title: "Comment la musique modifie littéralement ton cerveau", description: "Neuroscience de la musique" },
  { title: "Les 5 erreurs mentales qui te font perdre de l'argent", description: "Biais cognitifs et finance" },
  { title: "Pourquoi les gens les plus intelligents prennent parfois les pires décisions", description: "Le paradoxe de l'intelligence" },
  { title: "Comment les couleurs influencent tes achats sans que tu le saches", description: "Psychologie du marketing visuel" },
  { title: "Le pouvoir caché du silence dans la communication", description: "Techniques d'écoute active" },
  { title: "Comment les chefs étoilés manipulent ta perception du goût", description: "Neurogastronomie et psychologie" },
  { title: "Les stratégies mentales des champions olympiques", description: "Préparation mentale et performance" },
  { title: "Comment la gravité affecte ton corps au quotidien", description: "Physique du corps humain" },
  { title: "Les codes secrets du langage corporel", description: "Communication non-verbale" },
  { title: "Pourquoi tu rêves et ce que ça révèle de toi", description: "Neuroscience des rêves" },
  { title: "Comment l'espace change ton corps en altitude zéro", description: "Astronaute et physiologie" },
  { title: "Les illusions d'optique qui prouvent que ton cerveau te ment", description: "Perception visuelle et neurosciences" },
  { title: "Pourquoi les grands leaders prennent des décisions contre-intuitives", description: "Psychologie du leadership" },
  { title: "Comment ton téléphone détruit ta capacité de concentration", description: "Neuroscience de l'attention" },
  { title: "Les stratégies de mémorisation des champions de mémoire", description: "Techniques de mnémotechnique avancées" },
  { title: "Pourquoi les prix se terminent toujours par 9", description: "Psychologie des prix et économie comportementale" },
  { title: "Comment les parfums influencent tes émotions et tes souvenirs", description: "Neuroscience de l'olfaction" },
  { title: "Le phénomène étrange de la synchronisation humaine", description: "Quand les foules se mettent à pulser ensemble" },
  { title: "Pourquoi les intros manquent la plupart des créateurs", description: "Psychologie musicale et structure cognitive" },
  { title: "Comment les casinos te font perdre sans que tu t'en rendes compte", description: "Design addictif et économie comportementale" },
  { title: "Les mathématiques cachées dans la nature", description: "Nombre d'or, fractales et suites de Fibonacci" },
  { title: "Pourquoi certaines personnes attirent tout le monde sans effort", description: "Psychologie du charisme magnétique" },
  { title: "Comment les films de Pixar manipulent tes émotions scientifiquement", description: "Narratologie et neuroscience" },
  { title: "Le secret des octogénaires qui travaillent 4 heures par jour", description: "Productivité et gestion de l'énergie" },
  { title: "Pourquoi ton cerveau ne peut pas résister aux stories Instagram", description: "Dopamine et design addictif" },
  { title: "Les techniques militaires pour prendre des décisions sous pression", description: "Prise de décision et stress" },
  { title: "Comment les supermarchés te font acheter plus sans que tu le saches", description: "Design d'espace et marketing sensoriel" },
  { title: "Pourquoi les États-Unis n'ont jamais adopté le système métrique", description: "Histoire des sciences et politique" },
  { title: "Comment les deepfakes changent la vérité en 2025", description: "IA et éthique numérique" },
  { title: "Le paradoxe du choix : pourquoi plus d'options rend plus difficile de choisir", description: "Psychologie de la décision" },
  { title: "Comment les abeilles résolvent des problèmes que les superordinateurs peinent à résoudre", description: "Intelligence animale et informatique" },
  { title: "Pourquoi les musées te fatiguent sans que tu t'en rendes compte", description: "Neuroscience et design d'exposition" },
  { title: "La science derrière les rires en groupe et pourquoi c'est contagieux", description: "Psychologie sociale et évolution" },
  { title: "Comment les algorithmes de recommandation créent des bulles de filtres", description: "Technologie et société" },
  { title: "Pourquoi certains bruits (comme la pluie) te rendent plus productif", description: "Psychoacoustique et concentration" },
  { title: "Les stratégies d'espionnage utilisées dans le commerce moderne", description: "Intelligence économique" },
  { title: "Comment ton odorat influence tes choix sans que tu le saches", description: "Neuroscience sensorielle" },
  { title: "Pourquoi les meilleurs athlètes visualisent avant de performer", description: "Psychologie du sport et imagerie mentale" },
  { title: "Les effets insoupçonnés de la musique sur la productivité", description: "Neuroscience appliquée" },
  { title: "Comment les architectes utilisent la psychologie pour influencer ton comportement", description: "Psychologie environnementale" },
  { title: "Pourquoi le silence est devenu un luxe en 2025", description: "Sociologie et bien-être" },
  { title: "Les méthodes de persuasion utilisées par les plus grandes marques", description: "Marketing et psychologie" },
  { title: "Comment la couleur de ta chambre affecte la qualité de ton sommeil", description: "Chronobiologie et environnement" },
  { title: "Pourquoi les investisseurs riches lisent la fiction", description: "Psychologie de l'investissement" },
  { title: "Les phénomènes de foule expliqués par la physique", description: "Physique sociale et mouvements collectifs" },
  { title: "Comment les bateaux autonomes changent le commerce mondial", description: "Technologie et économie maritime" },
  { title: "Pourquoi certaines langues n'ont pas de mots pour les couleurs", description: "Linguistique et perception" },
  { title: "Les secrets de fabrication des instruments de musique les plus chers", description: "Acoustique et artisanat" },
];

/**
 * Get recently used topic titles from the database (persistent, not in-memory).
 * Returns the last 50 used topics.
 */
async function getRecentlyUsedTopics(): Promise<string[]> {
  try {
    const used = await db.usedTopic.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { title: true },
    });
    return used.map((u) => u.title);
  } catch {
    return [];
  }
}

/**
 * Persist a topic title to the database so it's never suggested again.
 */
async function markTopicUsed(title: string): Promise<void> {
  try {
    await db.usedTopic.create({ data: { title } });
  } catch {
    // Unique constraint violation — topic already tracked, that's fine
  }
}

function getRandomFallback(usedTitles: string[]) {
  // Filter out recently used topics
  const available = fallbackTopics.filter((t) => !usedTitles.includes(t.title));
  const pool = available.length > 5 ? available : fallbackTopics;
  const t = pool[Math.floor(Math.random() * pool.length)];
  return t;
}

export async function POST(request: NextRequest) {
  try {
    // Get persistently tracked used topics from DB
    const recentTopics = await getRecentlyUsedTopics();
    const cacheHint = recentTopics.length > 0
      ? `\n\nSUJETS DÉJÀ PROPOSÉS (NE PROPOSE AUCUN DE CES SUJETS) :\n${recentTopics.slice(0, 20).map((t) => `- ${t}`).join("\n")}`
      : "";

    let topic: { title: string; description: string } | null = null;
    let usedFallback = false;

    // Try AI generation first
    try {
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
- TOUJOURS des titres ultra-spécifiques et niche

2. FORMAT PREMIUM
- Le titre doit ressembler à un cours à 200€ sur une plateforme premium
- Utilise des chiffres concrets quand c'est possible
- Crée un 'curiosity gap'

3. EFFET IRRESISTIBLE
- Le titre doit provoquer une réaction : 'Ah bon ? Vraiment ?'
- Le lecteur doit se dire : 'Je DOIS savoir ça'

4. VARIÉTÉ DES DOMAINES
Alterne entre : Sciences, Psychologie, Technologies, Arts, Histoire, Business, Santé, Sport, Cuisine, Espace, Cultures, Jeux vidéo, Argent, Relations humaines.

5. ORIGINALITÉ MAXIMALE
- Chaque titre doit être unique et inédit
${cacheHint}

N'utilise pas de guillemets doubles dans les valeurs des champs.`,
        },
        {
          role: "user",
          content: "Propose un sujet de cours aléatoire, original et fascinant que je n'ai jamais entendu auparavant.",
        },
      ]);

      const responseText = completion.content || "";

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

      if (topic && typeof topic === "object" && "title" in topic) {
        const t = topic as { title: string; description: string };
        // Persist to DB so this topic is never suggested again
        await markTopicUsed(t.title);
        return NextResponse.json({ success: true, topic: t });
      }
    } catch (aiError) {
      console.warn("[random] AI generation failed, using fallback:", aiError instanceof Error ? aiError.message : aiError);
    }

    // Fallback: return a random topic from predefined list
    usedFallback = true;
    const t = getRandomFallback(recentTopics);
    // Persist to DB
    await markTopicUsed(t.title);
    return NextResponse.json({ success: true, topic: t, fallback: true });
  } catch (error: unknown) {
    console.error("Random course error:", error);
    // Even on total failure, return a fallback topic
    const t = getRandomFallback([]);
    return NextResponse.json({ success: true, topic: t, fallback: true });
  }
}