import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { smartChatCompletion } from "@/lib/openai";
import { FREE_COURSE_LIMIT, MAX_SOURCE_LINKS, MAX_TOKENS } from "@/lib/constants";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("429") && attempt < retries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 0: WEB SEARCH — gather real-world facts to enrich the course
   ═══════════════════════════════════════════════════════════════════════════ */

interface SearchResult {
  name: string;
  snippet: string;
  url: string;
}

async function searchWebForTopic(
  zai: Awaited<ReturnType<typeof ZAI.create>> | null,
  topic: string,
  courseLang: string,
): Promise<string> {
  if (!zai) return "";

  try {
    // Search in the appropriate language
    const langQuery = courseLang === "en"
      ? `${topic} guide tutorial explained 2024 2025`
      : `${topic} guide tutoriel expliqué 2024 2025`;

    const results = await zai.functions.invoke("web_search", {
      query: langQuery,
      num: 5,
    });

    if (!Array.isArray(results) || results.length === 0) return "";

    const snippets = results
      .slice(0, 5)
      .map((r: SearchResult, i: number) => `[${i + 1}] ${r.name}: ${r.snippet}`)
      .join("\n\n");

    console.log(`[search] Found ${results.length} results for "${topic}"`);
    return snippets;
  } catch (error) {
    console.error("[search] Web search failed:", error instanceof Error ? error.message : error);
    return "";
  }
}

/* ── Web scraping (from source links) ──────────────────────────────────── */

interface ScrapedPage {
  title: string;
  text: string;
  url: string;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeSourceLinks(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  sourceLinks: string[],
): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  const maxLinks = Math.min(sourceLinks.length, MAX_SOURCE_LINKS);

  for (let i = 0; i < maxLinks; i++) {
    const url = sourceLinks[i];
    if (!url || !url.startsWith("http")) continue;

    try {
      const result = await zai.functions.invoke("page_reader", { url });
      const html = result.data?.html || "";
      const text = htmlToPlainText(html);
      const title = result.data?.title || url;
      const truncatedText = text.length > 2000 ? text.slice(0, 2000) + "..." : text;

      if (truncatedText.length > 50) {
        results.push({ title, text: truncatedText, url });
      }
    } catch (error) {
      console.error(`[scrape] FAIL: ${url}`);
    }
  }

  return results;
}

function buildSourceContext(scrapedPages: ScrapedPage[]): string {
  if (scrapedPages.length === 0) return "";
  const parts = scrapedPages.map((page, i) => {
    return `--- Source ${i + 1}: ${page.title} ---\n${page.text}`;
  });
  return `\n\nVoici du contenu extrait des liens sources. Utilise ces informations pour enrichir le cours avec des données réelles et des exemples concrets :\n\n${parts.join("\n\n")}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1: OUTLINE GENERATION — structured plan before content
   ═══════════════════════════════════════════════════════════════════════════ */

interface OutlineChapter {
  title: string;
  goal: string;
  keyConcepts: string[];
  plannedAnalogy: string;
  plannedExample: string;
  mythToBust: string;
  reflectionQuestion: string;
  realAction: string;
}

interface OutlineResult {
  description: string;
  chapters: OutlineChapter[];
}

function buildOutlinePrompt(
  title: string,
  courseLang: string,
  level: number,
  webContext: string,
  sourceContext: string,
): string {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = [
    "Débutant (Level 1) — zero jargon, ultra-simple",
    "Intermédiaire (Level 2) — builds on basics, professional",
    "Avancé (Level 3) — edge cases, latest advances, expert depth",
  ];

  const langNote = courseLang === "en"
    ? "Write the ENTIRE outline in English."
    : "Rédige l'intégralité du plan en français.";

  let contextBlock = "";
  if (webContext || sourceContext) {
    contextBlock = `
═══ CONTEXTE DE RECHERCHE ═══
${webContext || "Aucune donnée de recherche disponible."}
${sourceContext || ""}
Utilise ces informations pour planifier des exemples et faits CONCRETS et RÉELS dans chaque chapitre.`;
  }

  return `Tu es un architecte pédagogique d'exception. Ta mission : créer un plan de cours STRUCTURÉ et APPROFONDI qui garantit une expérience d'apprentissage optimale.

Sujet : ${title}
Langue : ${langLabels[courseLang] || "français"}
Niveau : ${levelLabels[level] || levelLabels[1]}
Nombre de chapitres : entre 4 et 6 (ton choix selon le sujet)
${langNote}

${contextBlock}

═══ RÈGLES ABSOLUES POUR LE PLAN ═══

1. PROGRESSION LOGIQUE : chaque chapitre doit construire sur le précédent. L'ordre des concepts doit avoir un "pourquoi maintenant" évident.
2. CONCRET > ABSTRAIT : chaque chapitre doit contenir au moins un concept ancré dans la vie réelle.
3. VARIÉTÉ : les analogies doivent être variées (cuisine, sport, musique, gaming, argent, nature, relations...).
4. ANCRAGE RÉEL : utilise les données de recherche ci-dessus pour des exemples et faits vérifiables.
5. DIFFÉRENTIATION PAR NIVEAU :
   - Débutant : zéro jargon, analogies évidentes, rythme très progressif
   - Intermédiaire : vrais noms techniques, cas d'usage professionnels, nuance
   - Avancé : paradoxes, débats actuels, remise en question

═══ FORMAT DE RÉPONSE ═══

Réponds UNIQUEMENT avec ce JSON valide — aucun texte avant ou après :

{
  "description": "Description captivante du cours en 2-3 phrases qui donne envie de commencer",
  "chapters": [
    {
      "title": "Titre du chapitre",
      "goal": "Ce que le lecteur comprendra précisément après ce chapitre",
      "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],
      "plannedAnalogy": "Analogie concrète et familière pour le concept principal",
      "plannedExample": "Exemple réel et spécifique (avec nombres, noms, situations précises)",
      "mythToBust": "Une idée reçue courante que ce chapitre démentira",
      "reflectionQuestion": "Question de réflexion qui fait PENSER le lecteur",
      "realAction": "Action concrète que le lecteur peut faire dans sa vie dès aujourd'hui"
    }
  ]
}`;
}

async function generateOutline(
  title: string,
  courseLang: string,
  level: number,
  webContext: string,
  sourceContext: string,
): Promise<OutlineResult | null> {
  const systemPrompt = buildOutlinePrompt(title, courseLang, level, webContext, sourceContext);

  const completion = await smartChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Crée le plan détaillé du cours sur : ${title}` },
  ], { maxTokens: 4096, temperature: 0.6 });

  const text = completion.content || "";
  console.log(`[outline] AI response length: ${text.length} chars, provider: ${completion.provider}`);

  return extractOutline(text);
}

function extractOutline(text: string): OutlineResult | null {
  let cleaned = text.trim();

  // Extract from ```json code block
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  // Find outermost JSON
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") continue;
    if (cleaned[i] === "\"") {
      let j = i + 1;
      while (j < cleaned.length) {
        if (cleaned[j] === "\\") { j += 2; continue; }
        if (cleaned[j] === "\"") break;
        j++;
      }
      i = j;
      continue;
    }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") { depth--; }
  }

  const snippet = lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned.slice(firstBrace);

  try {
    const data = JSON.parse(snippet) as Record<string, unknown>;
    if (!data.chapters || !Array.isArray(data.chapters)) return null;

    const description = typeof data.description === "string" ? data.description : "";
    const chapters: OutlineChapter[] = [];

    for (const ch of data.chapters) {
      if (!ch || typeof ch !== "object") continue;
      const c = ch as Record<string, unknown>;
      if (typeof c.title === "string" && c.title.trim()) {
        chapters.push({
          title: c.title.trim(),
          goal: typeof c.goal === "string" ? c.goal.trim() : "",
          keyConcepts: Array.isArray(c.keyConcepts) ? c.keyConcepts.map(String) : [],
          plannedAnalogy: typeof c.plannedAnalogy === "string" ? c.plannedAnalogy.trim() : "",
          plannedExample: typeof c.plannedExample === "string" ? c.plannedExample.trim() : "",
          mythToBust: typeof c.mythToBust === "string" ? c.mythToBust.trim() : "",
          reflectionQuestion: typeof c.reflectionQuestion === "string" ? c.reflectionQuestion.trim() : "",
          realAction: typeof c.realAction === "string" ? c.realAction.trim() : "",
        });
      }
    }

    return chapters.length > 0 ? { description, chapters } : null;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2: CHAPTER-BY-CHAPTER GENERATION — rich content from outline
   ═══════════════════════════════════════════════════════════════════════════ */

function buildChapterPrompt(
  courseTitle: string,
  courseLang: string,
  level: number,
  chapterIndex: number,
  totalChapters: number,
  outline: OutlineChapter,
  webContext: string,
  sourceContext: string,
): string {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = [
    "Débutant — zero jargon, ultra-simple, chaque terme nouveau immédiatement expliqué",
    "Intermédiaire — builds on basics, professional examples, introduces nuance",
    "Avancé — edge cases, paradoxes, latest advances, expert-level depth",
  ];
  const langNote = courseLang === "en"
    ? "You MUST write the ENTIRE chapter in English."
    : "Tu DOIS rédiger l'intégralité du chapitre en français.";

  let researchBlock = "";
  if (webContext || sourceContext) {
    researchBlock = `
═══ DONNÉES DE RECHERCHE (utilise-les pour des faits et exemples RÉELS) ═══
${webContext || ""}
${sourceContext || ""}
═══ FIN DES DONNÉES DE RECHERCHE ═══`;
  }

  return `Tu es Coursia AI, un professeur IA d'exception. Ton métier : transformer chaque chapitre en une expérience de compréhension profonde et inoubliable.

═══ CONTEXTE DU COURS ═══
Cours : ${courseTitle}
Langue : ${langLabels[courseLang] || "français"}
Niveau : ${levelLabels[level] || levelLabels[1]}
Chapitre ${chapterIndex + 1} sur ${totalChapters}
${langNote}

${researchBlock}

═══ PLAN DE CE CHAPITRE (tu DOIS suivre ce plan) ═══
Titre : ${outline.title}
Objectif : ${outline.goal}
Concepts à couvrir : ${outline.keyConcepts.join(", ")}
Analogie prévue : ${outline.plannedAnalogy}
Exemple prévu : ${outline.plannedExample}
Mythe à démanteler : ${outline.mythToBust}
Question de réflexion : ${outline.reflectionQuestion}
Action concrète : ${outline.realAction}

═══ PHILOSOPHIE PÉDAGOGIQUE (règles absolues) ═══

1. COMPRÉHENSION > MÉMORISATION
Le lecteur doit COMPRENDRE si bien qu'il se souvient naturellement. Rends les choses évidentes par la logique et les analogies.

2. EXEMPLES > DÉFINITIONS
Montre toujours AVANT de définir. Un bon exemple vaut 10 définitions. Chaque concept abstrait doit être ancré dans quelque chose de tangible et familier.

3. CONCRET > ABSTRAIT
Connecte chaque concept à la vraie vie. Chaque idée doit pouvoir se raconter à un ami au dinner.

4. ACTIF > PASSIF
Le lecteur doit PENSER pendant qu'il lit. Pose des questions, provoque des réflexions.

═══ STRUCTURE OBLIGATOIRE DU CHAPITRE ═══

Tu DOIS utiliser exactement ces sous-titres (##) :

## L'essentiel en une question
Ouvre avec une question qui provoque l'envie de connaître la réponse. Le lecteur doit VOULOIR continuer après les 3 premières lignes.

## Pourquoi ça compte
Connecte ce chapitre au parcours global. Montre la valeur immédiate de ce qu'on va apprendre. Pourquoi ce chapitre existe.

## Les concepts clés
Pour CHAQUE concept (${outline.keyConcepts.join(", ")}), respecte cet ordre :
1. Explication simple (2-3 phrases max, mots de tous les jours)
2. Exemple concret et spécifique (avec détails précis — noms, chiffres, situations)
3. Analogie familière (utilise cet analogie prévue : ${outline.plannedAnalogy})
4. Erreur courante à éviter

> [Insère un blocquote avec l'insight le plus important de ce chapitre]

## Mythe démanti
${outline.mythToBust}
Explique pourquoi cette idée reçue est fausse et quelle est la réalité.

## Réfléchis un instant
${outline.reflectionQuestion}
Fais RÉFLÉCHIR le lecteur. Pas de QCM mécanique — une vraie question ouverte.

## Ce que tu peux faire maintenant
Résume en 3-4 points clés.
Action concrète : ${outline.realAction}

═══ TECHNIQUES D'ÉCRITURE OBLIGATOIRES ═══

- Au moins 2 ANALOGIES de la vie courante (cuisine, sport, musique, gaming, argent, santé...)
- Au moins 2 QUESTIONS RHÉTORIQUES ('Et si...?', 'Pourquoi penses-tu que...?')
- Au moins 1 EXEMPLE NUMÉRIQUE (pourcentages, montants, durées, quantités)
- Au moins 1 COMPARAISON ('La différence entre X et Y...')
- Au moins 1 REFORMULATION après une explication complexe ('En d'autres termes : ...')

═══ STYLE D'ÉCRITURE ═══

- Ton direct mais chaleureux, comme un bon mentor
- Phrases courtes et percutantes, max 3 lignes sans ponctuation forte
- Paragraphes de 2 à 4 phrases MAXIMUM
- **Gras** pour les termes clés uniquement
- Listes à puces (-) pour les étapes
- Citations en bloc (>) pour les points essentiels
- Variété rythmique : alterne phrases courtes, moyennes, questions

═══ INTERDIT ═══

- Jargon sans explication immédiate
- Remplissage et phrases vides
- Invention de statistiques (utilise les données de recherche)
- Paragraphes de plus de 4 phrases
- Ton professoral ennuyeux
- Double quotes ("") dans le JSON — utilise seulement des apostrophes ('')

═══ FORMAT DE RÉPONSE ═══

Réponds UNIQUEMENT avec ce JSON valide — aucun texte avant ou après, pas de markdown fence :

{"title":"${outline.title}","content":"## L'essentiel en une question\\n\\n[Ton texte]\\n\\n## Pourquoi ça compte\\n\\n[Ton texte]\\n\\n## Les concepts clés\\n\\n[Ton texte]\\n\\n> [Insight]\\n\\n## Mythe démanti\\n\\n[Ton texte]\\n\\n## Réfléchis un instant\\n\\n[Ton texte]\\n\\n## Ce que tu peux faire maintenant\\n\\n[Ton texte]","summary":"Résumé en une phrase de ce que le lecteur comprend maintenant"}`;
}

async function generateChapter(
  courseTitle: string,
  courseLang: string,
  level: number,
  chapterIndex: number,
  totalChapters: number,
  outline: OutlineChapter,
  webContext: string,
  sourceContext: string,
): Promise<{ title: string; content: string; summary: string } | null> {
  const systemPrompt = buildChapterPrompt(
    courseTitle, courseLang, level, chapterIndex, totalChapters,
    outline, webContext, sourceContext,
  );

  const completion = await smartChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Rédige le chapitre ${chapterIndex + 1} : ${outline.title}` },
  ], { maxTokens: MAX_TOKENS, temperature: 0.7 });

  const text = completion.content || "";
  console.log(`[chapter-${chapterIndex + 1}] AI response: ${text.length} chars, provider: ${completion.provider}`);

  return extractChapter(text);
}

/* ── JSON extraction for single chapter ──────────────────────────────────── */

function extractChapter(text: string): { title: string; content: string; summary: string } | null {
  let cleaned = text.trim();

  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") continue;
    if (cleaned[i] === "\"") {
      let j = i + 1;
      while (j < cleaned.length) {
        if (cleaned[j] === "\\") { j += 2; continue; }
        if (cleaned[j] === "\"") break;
        j++;
      }
      i = j;
      continue;
    }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") { depth--; }
  }

  const snippet = lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned.slice(firstBrace);

  // Try direct parse
  try {
    const data = JSON.parse(snippet) as Record<string, unknown>;
    if (typeof data.title === "string" && data.title.trim() && typeof data.content === "string" && data.content.trim()) {
      return {
        title: data.title.trim(),
        content: data.content.trim(),
        summary: typeof data.summary === "string" ? data.summary.trim() : "",
      };
    }
  } catch { /* continue */ }

  // Recovery: try fixing common JSON issues
  try {
    const fixed = snippet
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u201C\u201D\u2018\u2019]/g, "'");
    const data = JSON.parse(fixed) as Record<string, unknown>;
    if (typeof data.title === "string" && data.title.trim() && typeof data.content === "string" && data.content.trim()) {
      return {
        title: data.title.trim(),
        content: data.content.trim(),
        summary: typeof data.summary === "string" ? data.summary.trim() : "",
      };
    }
  } catch { /* continue */ }

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3: QUALITY VALIDATION
   ═══════════════════════════════════════════════════════════════════════════ */

interface QualityReport {
  passed: boolean;
  wordCount: number;
  headingCount: number;
  issues: string[];
}

function validateChapterQuality(content: string): QualityReport {
  const issues: string[] = [];
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const headingMatches = content.match(/^##\s+.+$/gm) || [];
  const headingCount = headingMatches.length;

  if (wordCount < 300) {
    issues.push(`Content too short (${wordCount} words, minimum 300)`);
  }
  if (headingCount < 3) {
    issues.push(`Too few headings (${headingCount}, minimum 3)`);
  }

  return {
    passed: issues.length === 0,
    wordCount,
    headingCount,
    issues,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACK: Single-call generation (if 2-step fails)
   ═══════════════════════════════════════════════════════════════════════════ */

async function generateCourseSingleCall(
  title: string, courseLang: string, level: number,
  webContext: string, sourceContext: string,
) {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const levelLabels = [
    "Débutant — zero jargon, ultra-simple",
    "Intermédiaire — builds on basics, professional",
    "Avancé — edge cases, paradoxes, expert depth",
  ];
  const langNote = courseLang === "en"
    ? "You MUST write the ENTIRE course in English."
    : "Tu DOIS rédiger l'intégralité du cours en français.";

  const researchBlock = (webContext || sourceContext)
    ? `\n\nDONNÉES DE RECHERCHE :\n${webContext}\n${sourceContext}\nUtilise ces données pour des exemples et faits RÉELS.`
    : "";

  const completion = await smartChatCompletion([
    {
      role: "system",
      content: [
        "Tu es Coursia AI, un professeur IA d'exception. Tu transformes n'importe quel sujet en une expérience de compréhension profonde.",
        "",
        `Langue : ${langLabels[courseLang] || "français"}`,
        `Niveau : ${levelLabels[level] || levelLabels[1]}`,
        `${langNote}`,
        "",
        "RÈGLES ABSOLUES :",
        "- COMPRÉHENSION > MÉMORISATION — rends les choses évidentes par la logique et les analogies",
        "- EXEMPLES > DÉFINITIONS — montre toujours AVANT de définir",
        "- CONCRET > ABSTRAIT — connecte chaque concept à la vraie vie",
        "- Au moins 2 analogies, 2 questions rhétoriques, 1 exemple numérique par chapitre",
        "- Paragraphes de 2-4 phrases max, phrases courtes, ton direct mais chaleureux",
        "- Chaque chapitre : 400+ mots minimum, 3+ sous-titres (##) obligatoires",
        "- Structure par chapitre : ## Question d'accroche → ## Pourquoi ça compte → ## Concepts clés (avec analogies, exemples, erreurs courantes) → ## Mythe démanti → ## Réfléchis un instant → ## Action concrète",
        researchBlock,
        "",
        "Réponds UNIQUEMENT avec ce JSON valide — aucun texte avant ou après :",
        '',
        '{"description":"Description en 2-3 phrases","chapters":[{"title":"Titre","content":"## Question d\'accroche\\n\\n[texte]\\n\\n## Pourquoi ça compte\\n\\n[texte]\\n\\n## Concepts clés\\n\\n[texte]\\n\\n> [Insight]\\n\\n## Mythe démanti\\n\\n[texte]\\n\\n## Réfléchis un instant\\n\\n[texte]\\n\\n## Action concrète\\n\\n[texte]","summary":"Résumé en une phrase"}]}',
      ].join("\n"),
    },
    { role: "user", content: `Crée un cours (4-6 chapitres) sur : ${title}` },
  ], { maxTokens: MAX_TOKENS, temperature: 0.7 });

  const text = completion.content || "";
  console.log(`[fallback] AI response length: ${text.length} chars, provider: ${completion.provider}`);
  return extractCourseJSON(text);
}

function extractCourseJSON(text: string): { description: string; chapters: Array<{ title: string; content: string; summary: string }> } | null {
  let cleaned = text.trim();

  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") continue;
    if (cleaned[i] === "\"") {
      let j = i + 1;
      while (j < cleaned.length) {
        if (cleaned[j] === "\\") { j += 2; continue; }
        if (cleaned[j] === "\"") break;
        j++;
      }
      i = j;
      continue;
    }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") { depth--; }
  }

  const snippet = lastBrace > firstBrace
    ? cleaned.slice(firstBrace, lastBrace + 1)
    : cleaned.slice(firstBrace);

  try {
    const data = JSON.parse(snippet) as Record<string, unknown>;
    if (!data.chapters || !Array.isArray(data.chapters)) return null;
    const description = typeof data.description === "string" ? data.description : "";
    const chapters: Array<{ title: string; content: string; summary: string }> = [];
    for (const ch of data.chapters) {
      if (!ch || typeof ch !== "object") continue;
      const c = ch as Record<string, unknown>;
      if (typeof c.title === "string" && c.title.trim() && typeof c.content === "string" && c.content.trim()) {
        chapters.push({
          title: c.title.trim(),
          content: c.content.trim(),
          summary: typeof c.summary === "string" ? c.summary.trim() : "",
        });
      }
    }
    return chapters.length > 0 ? { description, chapters } : null;
  } catch {
    // Recovery
    try {
      const fixed = snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'");
      const data = JSON.parse(fixed) as Record<string, unknown>;
      if (!data.chapters || !Array.isArray(data.chapters)) return null;
      const description = typeof data.description === "string" ? data.description : "";
      const chapters: Array<{ title: string; content: string; summary: string }> = [];
      for (const ch of data.chapters) {
        if (!ch || typeof ch !== "object") continue;
        const c = ch as Record<string, unknown>;
        if (typeof c.title === "string" && c.title.trim() && typeof c.content === "string" && c.content.trim()) {
          chapters.push({ title: c.title.trim(), content: c.content.trim(), summary: typeof c.summary === "string" ? c.summary.trim() : "" });
        }
      }
      return chapters.length > 0 ? { description, chapters } : null;
    } catch { return null; }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const { title, sourceLinks = [], level = 0, courseLang = "fr", userId } = await request.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // ── Free preview limit ──
    if (userId) {
      const [user, existingCourses] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } }),
        db.course.count({ where: { userId } }),
      ]);

      const hasSubscription = user?.subscriptionStatus === "active";
      if (!hasSubscription && existingCourses >= FREE_COURSE_LIMIT) {
        return NextResponse.json({ error: "FREE_LIMIT", requiresSubscription: true }, { status: 403 });
      }
    }

    // ── Step 0: Web search + source scraping ──
    let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
    let webContext = "";
    let scrapedPages: ScrapedPage[] = [];

    try {
      zaiInstance = await ZAI.create();

      // Parallel: web search + source link scraping
      const [searchResults, scraped] = await Promise.all([
        searchWebForTopic(zaiInstance, title, courseLang),
        sourceLinks.length > 0 ? scrapeSourceLinks(zaiInstance, sourceLinks) : Promise.resolve([]),
      ]);

      webContext = searchResults;
      scrapedPages = scraped;
    } catch {
      console.log("[generate] z-ai SDK unavailable, skipping search/scraping");
    }

    const sourceContext = buildSourceContext(scrapedPages);

    console.log(`[generate] Starting 2-step generation for "${title}" (web: ${webContext.length > 0 ? "yes" : "no"}, sources: ${scrapedPages.length})`);

    // ── Step 1: Generate outline ──
    let outline = await generateOutline(title, courseLang, level, webContext, sourceContext);

    if (!outline || outline.chapters.length < 3) {
      console.log("[generate] Outline generation failed or too few chapters, falling back to single-call...");
      const fallbackResult = await generateCourseSingleCall(title, courseLang, level, webContext, sourceContext);

      if (!fallbackResult || fallbackResult.chapters.length === 0) {
        return NextResponse.json(
          { error: "L'IA n'a pas pu générer un cours valide. Réessaie." },
          { status: 500 },
        );
      }

      // Save fallback result
      const course = await saveCourse(title, level, userId, sourceLinks, fallbackResult.description, fallbackResult.chapters, scrapedPages.length);
      return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
    }

    console.log(`[generate] Outline created: ${outline.chapters.length} chapters planned`);

    // ── Step 2: Generate each chapter individually ──
    const generatedChapters: Array<{ title: string; content: string; summary: string }> = [];

    for (let i = 0; i < outline.chapters.length; i++) {
      const chapterOutline = outline.chapters[i];

      let chapter = await generateChapter(
        title, courseLang, level, i, outline.chapters.length,
        chapterOutline, webContext, sourceContext,
      );

      // If chapter generation fails, retry once with simplified context
      if (!chapter) {
        console.log(`[generate] Chapter ${i + 1} failed, retrying...`);
        chapter = await generateChapter(
          title, courseLang, level, i, outline.chapters.length,
          chapterOutline, "", "",
        );
      }

      if (chapter) {
        // Quality validation
        const quality = validateChapterQuality(chapter.content);
        if (!quality.passed) {
          console.log(`[generate] Chapter ${i + 1} quality issues: ${quality.issues.join(", ")}`);
        }
        generatedChapters.push(chapter);
      } else {
        console.warn(`[generate] Chapter ${i + 1} completely failed, skipping`);
      }
    }

    if (generatedChapters.length === 0) {
      // Last resort fallback
      console.log("[generate] All chapters failed, trying single-call fallback...");
      const fallbackResult = await generateCourseSingleCall(title, courseLang, level, webContext, sourceContext);

      if (!fallbackResult || fallbackResult.chapters.length === 0) {
        return NextResponse.json(
          { error: "L'IA n'a pas pu générer un cours valide. Réessaie." },
          { status: 500 },
        );
      }

      const course = await saveCourse(title, level, userId, sourceLinks, fallbackResult.description, fallbackResult.chapters, scrapedPages.length);
      return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
    }

    console.log(`[generate] Generated ${generatedChapters.length}/${outline.chapters.length} chapters`);

    // ── Step 3: Save to database ──
    const course = await saveCourse(title, level, userId, sourceLinks, outline.description, generatedChapters, scrapedPages.length);
    return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
  } catch (error: unknown) {
    console.error("Course generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ── Helpers: Save course and build response ────────────────────────────── */

async function saveCourse(
  title: string,
  level: number,
  userId: string | null,
  sourceLinks: string[],
  description: string,
  chapters: Array<{ title: string; content: string; summary: string }>,
  scrapedCount: number,
) {
  const course = await db.course.create({
    data: {
      title: title.trim(),
      description,
      sourceLinks: JSON.stringify(sourceLinks),
      level,
      flameCost: 0,
      userId: userId || null,
      chapters: {
        create: chapters.map((ch, idx) => ({
          title: ch.title,
          content: ch.content,
          summary: ch.summary,
          order: idx + 1,
          level,
        })),
      },
    },
    include: {
      chapters: {
        orderBy: { order: "asc" },
      },
    },
  });

  await db.courseProgress.upsert({
    where: { courseId: course.id },
    create: { courseId: course.id },
    update: {},
  });

  return course;
}

function buildResponse(
  course: { id: string; title: string; description: string; createdAt: Date; chapters: Array<{ id: string; title: string; content: string; summary: string; order: number; level: number }> },
  sourceLinks: string[],
  scrapedSources: number,
) {
  return {
    success: true,
    scrapedSources,
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      sourceLinks,
      createdAt: course.createdAt,
      chapters: course.chapters.map((ch) => ({
        id: ch.id,
        title: ch.title,
        content: ch.content,
        summary: ch.summary,
        order: ch.order,
        level: ch.level,
      })),
    },
  };
}
