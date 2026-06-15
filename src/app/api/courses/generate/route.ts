import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { smartChatCompletion } from "@/lib/openai";
import { FREE_COURSE_LIMIT, MAX_SOURCE_LINKS, MAX_TOKENS } from "@/lib/constants";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("429") && attempt < retries) { await sleep(2000 * (attempt + 1)); continue; }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 0: MULTI-ANGLE WEB SEARCH — 4 parallel queries for depth
   ═══════════════════════════════════════════════════════════════════════════ */

interface SearchResult {
  name: string;
  snippet: string;
  url: string;
}

async function searchOnce(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  query: string,
): Promise<string> {
  try {
    const results = await zai.functions.invoke("web_search", { query, num: 5 });
    if (!Array.isArray(results) || results.length === 0) return "";
    return results
      .slice(0, 4)
      .map((r: SearchResult, i: number) => `[${i + 1}] ${r.name}: ${r.snippet}`)
      .join("\n");
  } catch { return ""; }
}

async function deepSearch(
  zai: Awaited<ReturnType<typeof ZAI.create>> | null,
  topic: string,
  courseLang: string,
  level: number,
): Promise<string> {
  if (!zai) return "";

  const levelContext = level === 0
    ? "beginner tutorial guide"
    : level === 1
      ? "intermediate advanced techniques professional"
      : "expert advanced deep dive research masterclass";

  const langQ = courseLang === "en" ? "in english" : "en français";

  // 4 parallel searches from different angles
  const [r1, r2, r3, r4] = await Promise.all([
    searchOnce(zai, `${topic} ${levelContext} explained ${langQ}`),
    searchOnce(zai, `${topic} real world examples case studies applications ${langQ}`),
    searchOnce(zai, `${topic} common mistakes misconceptions pitfalls ${langQ}`),
    searchOnce(zai, `${topic} latest advances 2024 2025 trends future ${langQ}`),
  ]);

  const blocks: string[] = [];
  if (r1) blocks.push(`══ CONCEPTS & EXPLANATIONS ══\n${r1}`);
  if (r2) blocks.push(`══ REAL-WORLD EXAMPLES & CASES ══\n${r2}`);
  if (r3) blocks.push(`══ COMMON MISTAKES & MISCONCEPTIONS ══\n${r3}`);
  if (r4) blocks.push(`══ LATEST ADVANCES & TRENDS ══\n${r4}`);

  const combined = blocks.join("\n\n");
  const totalResults = [r1, r2, r3, r4].filter(Boolean).length;
  console.log(`[search] Deep search completed: ${totalResults}/4 queries returned results`);

  return combined;
}

/* ── Web scraping (from source links) ──────────────────────────────────── */

interface ScrapedPage { title: string; text: string; url: string; }

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

async function scrapeSourceLinks(zai: Awaited<ReturnType<typeof ZAI.create>>, sourceLinks: string[]): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  for (let i = 0; i < Math.min(sourceLinks.length, MAX_SOURCE_LINKS); i++) {
    const url = sourceLinks[i];
    if (!url?.startsWith("http")) continue;
    try {
      const result = await zai.functions.invoke("page_reader", { url });
      const html = result.data?.html || "";
      const text = htmlToPlainText(html);
      const title = result.data?.title || url;
      const truncatedText = text.length > 2000 ? text.slice(0, 2000) + "..." : text;
      if (truncatedText.length > 50) results.push({ title, text: truncatedText, url });
    } catch { console.error(`[scrape] FAIL: ${url}`); }
  }
  return results;
}

function buildSourceContext(scrapedPages: ScrapedPage[]): string {
  if (scrapedPages.length === 0) return "";
  const parts = scrapedPages.map((page, i) => `--- Source ${i + 1}: ${page.title} ---\n${page.text}`);
  return `\n\nCONTENU DES LIENS SOURCES :\n\n${parts.join("\n\n")}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1: OUTLINE — master plan with deep structure per chapter
   ═══════════════════════════════════════════════════════════════════════════ */

interface OutlineChapter {
  title: string;
  goal: string;
  keyConcepts: string[];
  subSections: string[];
  plannedAnalogy: string;
  plannedCaseStudy: string;
  plannedExample: string;
  mythToBust: string;
  reflectionQuestion: string;
  realAction: string;
  expertNote?: string;
}

interface OutlineResult { description: string; chapters: OutlineChapter[]; }

function buildOutlineSystemPrompt(
  title: string, courseLang: string, level: number, webContext: string, sourceContext: string,
): string {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const langNote = courseLang === "en" ? "Write EVERYTHING in English." : "Rédige TOUT en français.";

  const levelDesc = [
    `DÉBUTANT (niveau 1) :
- Zéro présupposé de connaissances. Tu pars du ZÉRO absolu.
- Chaque terme technique doit être défini IMMÉDIATEMENT.
- Analogies ultra-simples, exemples du quotidien.
- Rythme très progressif : un concept à la fois, bien verrouillé avant le suivant.
- Objectif : rendre le lecteur AUTONOME sur les bases du sujet.`,

    `INTERMÉDIAIRE (niveau 2) :
- Le lecteur connaît les bases. Tu construis SUR ces bases.
- Vocabulaire technique autorisé mais toujours expliqué en contexte.
- Exemples professionnels, cas d'usage réels, données chiffrées.
- Introduis la nuance : "ça dépend de...", "dans certains cas...", "le piège classique c'est..."
- Compare les approches, les frameworks, les écoles de pensée.
- Objectif : rendre le lecteur CAPABLE d'appliquer le sujet dans son métier.`,

    `AVANCÉ (niveau 3) :
- Le lecteur est déjà compétent. Tu le rends EXPERT.
- Cas limites, paradoxes, edge cases, exceptions aux règles.
- Dernières avancées de la recherche (2023-2025).
- Débats actuels entre experts du domaine — présente les deux camps.
- Remets en question les certitudes : "Ce que vous pensiez savoir..."
- Analyse critique, multi-perspectives, pensée de second ordre.
- Objectif : donner au lecteur un AVANTAGE COMPÉTITIF par sa compréhension profonde.`,
  ];

  let researchBlock = "";
  if (webContext || sourceContext) {
    researchBlock = `
═══ DONNÉES DE RECHERCHE (utilise-les pour enrichir le plan) ═══
${webContext || "Aucune donnée disponible."}
${sourceContext || ""}
═══ FIN DES DONNÉES DE RECHERCHE ═══`;
  }

  return `Tu es un architecte pédagogique d'élite mondiale. Tu conçois des cours qui sont références dans leur domaine.

SUJET : ${title}
LANGUE : ${langLabels[courseLang] || "français"}
${langNote}

${levelDesc[level] || levelDesc[1]}

${researchBlock}

═══ TA MISSION ═══
Crée un plan de cours de niveau ${level} qui couvre le sujet avec profondeur et rigueur.
Le plan doit être suffisamment détaillé pour qu'un autre expert puisse l'enseigner.

RÈGLES ABSOLUES :
1. PROGRESSION : chaque chapitre construit sur le précédent. Ordre logique, pas aléatoire.
2. PROFONDEUR : chaque chapitre doit contenir au moins 3 sous-sections distinctes.
3. CONCRET : chaque chapitre doit avoir au moins 1 cas réel ou exemple précis (noms, chiffres, situations).
4. ANALOGIES : variées (cuisine, sport, musique, finance, nature, technologie, santé...).
5. ANCRAGE RECHERCHE : intègre les données de recherche ci-dessus comme faits vérifiables.

Réponds UNIQUEMENT avec ce JSON valide :
{
  "description": "Description captivante du cours en 2-3 phrases qui donne immédiatement envie de commencer",
  "chapters": [
    {
      "title": "Titre précis du chapitre",
      "goal": "Ce que le lecteur maîtrisera précisément après ce chapitre (1 phrase)",
      "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],
      "subSections": ["Sous-section A", "Sous-section B", "Sous-section C"],
      "plannedAnalogy": "Analogie concrète, familière et originale pour le concept principal du chapitre",
      "plannedCaseStudy": "Cas réel ou exemple précis avec contexte (entreprise, personne, situation, chiffres)",
      "plannedExample": "Exemple chiffré et spécifique (montants, pourcentages, durées, comparaisons)",
      "mythToBust": "Une idée reçue que ce chapitre détruira avec des preuves",
      "reflectionQuestion": "Question de réflexion profonde qui force le lecteur à vraiment penser",
      "realAction": "Action concrète applicable immédiatement dans la vie/vie professionnelle du lecteur",
      "expertNote": "${level >= 2 ? "Note experte, nuance ou insight que seul un professionnel comprendrait" : ""}"
    }
  ]
}`;
}

async function generateOutline(
  title: string, courseLang: string, level: number, webContext: string, sourceContext: string,
): Promise<OutlineResult | null> {
  const systemPrompt = buildOutlineSystemPrompt(title, courseLang, level, webContext, sourceContext);
  const completion = await smartChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Conçois le plan détaillé du cours de niveau ${level} sur : ${title}` },
  ], { maxTokens: 4096, temperature: 0.5 });

  const text = completion.content || "";
  console.log(`[outline] Response: ${text.length} chars, provider: ${completion.provider}`);
  return extractOutline(text);
}

function extractOutline(text: string): OutlineResult | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0, lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") continue;
    if (cleaned[i] === "\"") { let j = i + 1; while (j < cleaned.length) { if (cleaned[j] === "\\") { j += 2; continue; } if (cleaned[j] === "\"") break; j++; } i = j; continue; }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") depth--;
  }

  const snippet = lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned.slice(firstBrace);

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
          subSections: Array.isArray(c.subSections) ? c.subSections.map(String) : [],
          plannedAnalogy: typeof c.plannedAnalogy === "string" ? c.plannedAnalogy.trim() : "",
          plannedCaseStudy: typeof c.plannedCaseStudy === "string" ? c.plannedCaseStudy.trim() : "",
          plannedExample: typeof c.plannedExample === "string" ? c.plannedExample.trim() : "",
          mythToBust: typeof c.mythToBust === "string" ? c.mythToBust.trim() : "",
          reflectionQuestion: typeof c.reflectionQuestion === "string" ? c.reflectionQuestion.trim() : "",
          realAction: typeof c.realAction === "string" ? c.realAction.trim() : "",
          expertNote: typeof c.expertNote === "string" ? c.expertNote.trim() : "",
        });
      }
    }
    return chapters.length > 0 ? { description, chapters } : null;
  } catch {
    // Recovery attempt
    try {
      const fixed = snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'");
      const data = JSON.parse(fixed) as Record<string, unknown>;
      if (!data.chapters || !Array.isArray(data.chapters)) return null;
      const description = typeof data.description === "string" ? data.description : "";
      const chapters: OutlineChapter[] = [];
      for (const ch of data.chapters) {
        if (!ch || typeof ch !== "object") continue;
        const c = ch as Record<string, unknown>;
        if (typeof c.title === "string" && c.title.trim()) {
          chapters.push({
            title: c.title.trim(), goal: typeof c.goal === "string" ? c.goal.trim() : "",
            keyConcepts: Array.isArray(c.keyConcepts) ? c.keyConcepts.map(String) : [],
            subSections: Array.isArray(c.subSections) ? c.subSections.map(String) : [],
            plannedAnalogy: typeof c.plannedAnalogy === "string" ? c.plannedAnalogy.trim() : "",
            plannedCaseStudy: typeof c.plannedCaseStudy === "string" ? c.plannedCaseStudy.trim() : "",
            plannedExample: typeof c.plannedExample === "string" ? c.plannedExample.trim() : "",
            mythToBust: typeof c.mythToBust === "string" ? c.mythToBust.trim() : "",
            reflectionQuestion: typeof c.reflectionQuestion === "string" ? c.reflectionQuestion.trim() : "",
            realAction: typeof c.realAction === "string" ? c.realAction.trim() : "",
          });
        }
      }
      return chapters.length > 0 ? { description, chapters } : null;
    } catch { return null; }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2: CHAPTER GENERATION — expert-level content from rich outline
   ═══════════════════════════════════════════════════════════════════════════ */

function buildChapterSystemPrompt(
  courseTitle: string, courseLang: string, level: number,
  chapterIdx: number, totalChapters: number, outline: OutlineChapter,
  webContext: string, sourceContext: string,
): string {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const langNote = courseLang === "en"
    ? "Rédige l'INTÉGRALITÉ en anglais."
    : "Rédige l'INTÉGRALITÉ en français.";

  let researchBlock = "";
  if (webContext || sourceContext) {
    researchBlock = `
═══ DONNÉES DE RECHERCHE ═══
${webContext}
${sourceContext}
═══ FIN DES DONNÉES ═══
IMPORTANT : Utilise ces données pour des faits, chiffres et exemples RÉELS et VÉRIFIABLES. Ne jamais inventer de statistiques.`;
  }

  const isAdvanced = level >= 2;

  return `Tu es un professeur d'exception, capable de rendre les sujets les plus complexes accessibles ET profonds à la fois.

═══ CONTEXTE ═══
Cours : ${courseTitle}
Langue : ${langLabels[courseLang] || "français"}
Niveau : ${level === 0 ? "Débutant" : level === 1 ? "Intermédiaire" : "Avancé"}
Chapitre ${chapterIdx + 1} sur ${totalChapters}
${langNote}
${researchBlock}

═══ PLAN DE CE CHAPITRE ═══
Titre : ${outline.title}
Objectif : ${outline.goal}
Concepts : ${outline.keyConcepts.join(", ")}
Sous-sections prévues : ${outline.subSections.join(" → ")}
Analogie prévue : ${outline.plannedAnalogy}
Cas d'étude prévu : ${outline.plannedCaseStudy}
Exemple chiffré prévu : ${outline.plannedExample}
Mythe à détruire : ${outline.mythToBust}
Question de réflexion : ${outline.reflectionQuestion}
Action concrète : ${outline.realAction}
${outline.expertNote ? `Note experte : ${outline.expertNote}` : ""}

═══ STRUCTURE OBLIGATOIRE (utilise exactement ces ## headings) ═══

## Ce que tu vas comprendre
Ouvre avec UNE question ou UN fait surprenant qui provoque immédiatement l'envie de continuer.
Le lecteur DOIT être accroché dans les 3 premières lignes.

## Pourquoi ce chapitre est crucial
Connecte ce chapitre au parcours global. Montre la valeur IMMÉDIATE.
Pourquoi maintenant ? Pourquoi ce chapitre est indispensable pour la suite ?

## Les fondamentaux
Pour CHAQUE concept (${outline.keyConcepts.join(", ")}), respecte cet ordre strict :
1. Définition claire (2-3 phrases, mots de tous les jours ${level >= 1 ? "puis traduction technique" : ""})
2. Exemple immédiat et PRÉCIS (pas théorique — noms, lieux, montants, situations)
3. Analogie familière (${outline.plannedAnalogy})
4. ${level >= 1 ? "Comment un expert pense à ce concept (nuance, exception, piège)" : "Erreur courante à éviter"}
5. ${level >= 2 ? "Comparaison avec une approche alternative ou un framework concurrent" : ""}

> [Insère OBLIGATOIREMENT un blockquote avec l'insight le plus important]

${level >= 2 ? `
## Cas d'étude : ${outline.plannedCaseStudy}
Analyse un cas réel en profondeur :
- Contexte et enjeux
- Approche utilisée et pourquoi
- Résultats chiffrés
- Leçons à retenir
- Comment le lecteur peut appliquer la même approche
` : ""}

## Ce que beaucoup de gens se trompent
${outline.mythToBust}
Explique POURQUOI cette idée reçue est fausse.
Appuie-toi sur les données de recherche si disponibles.
Montre la réalité avec un exemple concret.

## Réfléchis : ${outline.reflectionQuestion}
Fais VRAIMENT réfléchir le lecteur. Pas de QCM. Une question ouverte qui nécessite d'avoir compris le chapitre pour y répondre.

## Ce que tu peux faire dès maintenant
- Résumé en 3-4 points clés (pas de listing mécanique — reformule avec intelligence)
- Action concrète et immédiate : ${outline.realAction}

═══ TECHNIQUES OBLIGATOIRES DANS CE CHAPITRE ═══

1. Au moins 2 ANALOGIES de domaines variés (ne réutilise PAS le même domaine pour les 2)
2. Au moins 2 QUESTIONS RHÉTORIQUES intégrées dans le texte
3. Au moins 1 EXEMPLE CHIFFRÉ précis (pourcentages, montants, durées, ratios)
4. Au moins 1 MYTHE BUSTING avec preuve
5. Au moins 1 REFORMULATION après une explication complexe ("En d'autres termes...", "Autrement dit...")
6. ${level >= 1 ? "Au moins 1 COMPARAISON entre 2 approches/frameworks/écoles de pensée" : "Au moins 1 COMPARAISON (avant/après, avec/sans, pour/contre)"}
7. ${level >= 2 ? "Au moins 1 RÉFÉRENCE à une recherche récente, un expert reconnu ou une étude connue" : ""}
8. Chaque ## section doit contenir au moins 60 mots de contenu substantiel

═══ STYLE ═══

- Ton direct, chaleureux, confident — comme un mentor qui sait de quoi il parle
- Phrases courtes et percutantes (max 3 lignes sans ponctuation forte)
- Paragraphes de 2-4 phrases MAXIMUM
- **Gras** pour les termes clés uniquement
- Listes à puces (-) pour énumérations
- Citations en bloc (>) pour les insights essentiels
- Alterne : affirmation → question → exemple → reformulation
- Variété rythmique : courts, moyens, questions

═══ INTERDIT ═══

- Jargon sans explication immédiate
- Phrases vides, remplissage, contenu générique
- Invention de statistiques (utilise les données de recherche)
- Paragraphes de plus de 4 phrases
- Ton professoral, manuel scolaire, Wikipédia
- Contenu répétitif (chaque phrase apporte quelque chose de NOUVEAU)
- Double quotes (") dans le JSON — utilise seulement des apostrophes (')
- Moins de 500 mots par chapitre

═══ FORMAT DE RÉPONSE ═══

Réponds UNIQUEMENT avec ce JSON — aucun texte avant ou après, pas de markdown fence :

{"title":"${outline.title}","content":"## Ce que tu vas comprendre\\n\\n[Hook]\\n\\n## Pourquoi ce chapitre est crucial\\n\\n[Contexte]\\n\\n## Les fondamentaux\\n\\n[Concepts]\\n\\n> [Insight]\\n\\n${isAdvanced ? "## Cas d'étude\\n\\n[Analyse]\\n\\n" : ""}## Ce que beaucoup de gens se trompent\\n\\n[Mythe]\\n\\n## Réfléchis\\n\\n[Question]\\n\\n## Ce que tu peux faire dès maintenant\\n\\n[Résumé + Action]","summary":"Résumé en une phrase de ce que le lecteur maîtrise maintenant"}`;
}

async function generateChapter(
  courseTitle: string, courseLang: string, level: number,
  chapterIdx: number, totalChapters: number, outline: OutlineChapter,
  webContext: string, sourceContext: string,
): Promise<{ title: string; content: string; summary: string } | null> {
  const systemPrompt = buildChapterSystemPrompt(
    courseTitle, courseLang, level, chapterIdx, totalChapters,
    outline, webContext, sourceContext,
  );

  const completion = await smartChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Rédige le chapitre ${chapterIdx + 1} sur : ${outline.title}` },
  ], { maxTokens: MAX_TOKENS, temperature: 0.7 });

  const text = completion.content || "";
  console.log(`[chapter-${chapterIdx + 1}] ${text.length} chars, provider: ${completion.provider}`);
  return extractChapter(text);
}

function extractChapter(text: string): { title: string; content: string; summary: string } | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0, lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") continue;
    if (cleaned[i] === "\"") { let j = i + 1; while (j < cleaned.length) { if (cleaned[j] === "\\") { j += 2; continue; } if (cleaned[j] === "\"") break; j++; } i = j; continue; }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") depth--;
  }

  const snippet = lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned.slice(firstBrace);

  const tryParse = (s: string) => {
    try {
      const data = JSON.parse(s) as Record<string, unknown>;
      if (typeof data.title === "string" && data.title.trim() && typeof data.content === "string" && data.content.trim()) {
        return { title: data.title.trim(), content: data.content.trim(), summary: typeof data.summary === "string" ? data.summary.trim() : "" };
      }
    } catch { /* continue */ }
    return null;
  };

  return tryParse(snippet) || tryParse(snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'")) || null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3: QUALITY VALIDATION
   ═══════════════════════════════════════════════════════════════════════════ */

function validateChapterQuality(content: string, level: number): { passed: boolean; wordCount: number; headingCount: number; issues: string[] } {
  const issues: string[] = [];
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const headingCount = (content.match(/^##\s+.+$/gm) || []).length;
  const minWords = level >= 2 ? 500 : 400;

  if (wordCount < minWords) issues.push(`Content too short (${wordCount} words, minimum ${minWords})`);
  if (headingCount < 4) issues.push(`Too few sections (${headingCount}, minimum 4)`);

  return { passed: issues.length === 0, wordCount, headingCount, issues };
}

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACK: Single-call generation (if 2-step fails)
   ═══════════════════════════════════════════════════════════════════════════ */

async function generateSingleCall(
  title: string, courseLang: string, level: number, webContext: string, sourceContext: string,
) {
  const langLabels: Record<string, string> = { fr: "français", en: "english" };
  const langNote = courseLang === "en" ? "Write EVERYTHING in English." : "Rédige TOUT en français.";
  const researchBlock = (webContext || sourceContext) ? `\n\nDONNÉES DE RECHERCHE :\n${webContext}\n${sourceContext}\nUtilise ces données pour des faits RÉELS.` : "";

  const completion = await smartChatCompletion([
    { role: "system", content: [
      `Tu es Coursia AI. Tu crées des cours exceptionnels. Langue : ${langLabels[courseLang] || "français"}. ${langNote}`,
      "RÈGLES : compréhension > mémorisation, exemples > définitions, concret > abstrait.",
      "Chaque chapitre : 500+ mots, 4+ sous-titres (##), 2+ analogies, 1+ exemple chiffré, 1+ mythe busting, 1+ question réflexion.",
      "Structure par chapitre : Hook → Contexte → Concepts (avec analogies + exemples + erreurs) → Mythe → Réflexion → Action.",
      researchBlock,
      `Réponds UNIQUEMENT avec ce JSON : {"description":"...","chapters":[{"title":"...","content":"## Hook\\n\\n...\\n\\n## Contexte\\n\\n...\\n\\n## Concepts\\n\\n...\\n\\n> Insight\\n\\n## Mythe\\n\\n...\\n\\n## Réflexion\\n\\n...\\n\\n## Action\\n\\n...","summary":"..."}]}`,
    ].join("\n") },
    { role: "user", content: `Crée un cours de niveau ${level} (4-6 chapitres) sur : ${title}` },
  ], { maxTokens: MAX_TOKENS, temperature: 0.7 });

  const text = completion.content || "";
  console.log(`[fallback] ${text.length} chars, provider: ${completion.provider}`);
  return extractFallbackCourse(text);
}

function extractFallbackCourse(text: string): { description: string; chapters: Array<{ title: string; content: string; summary: string }> } | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0, lastBrace = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "\\") continue;
    if (cleaned[i] === "\"") { let j = i + 1; while (j < cleaned.length) { if (cleaned[j] === "\\") { j += 2; continue; } if (cleaned[j] === "\"") break; j++; } i = j; continue; }
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") { depth--; lastBrace = i; if (depth === 0) break; }
    if (cleaned[i] === "[") depth++;
    if (cleaned[i] === "]") depth--;
  }

  const snippet = lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned.slice(firstBrace);
  const tryParse = (s: string) => {
    try {
      const data = JSON.parse(s) as Record<string, unknown>;
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
  };

  return tryParse(snippet) || tryParse(snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'")) || null;
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

    // ── Free limit ──
    if (userId) {
      const [user, existingCourses] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } }),
        db.course.count({ where: { userId } }),
      ]);
      if (user?.subscriptionStatus !== "active" && existingCourses >= FREE_COURSE_LIMIT) {
        return NextResponse.json({ error: "FREE_LIMIT", requiresSubscription: true }, { status: 403 });
      }
    }

    // ── Step 0: Deep web search + source scraping (parallel) ──
    let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
    let webContext = "";
    let scrapedPages: ScrapedPage[] = [];

    try {
      zaiInstance = await ZAI.create();
      const [searchResults, scraped] = await Promise.all([
        deepSearch(zaiInstance, title, courseLang, level),
        sourceLinks.length > 0 ? scrapeSourceLinks(zaiInstance, sourceLinks) : Promise.resolve([]),
      ]);
      webContext = searchResults;
      scrapedPages = scraped;
    } catch {
      console.log("[generate] z-ai SDK unavailable, skipping search/scraping");
    }

    const sourceContext = buildSourceContext(scrapedPages);
    console.log(`[generate] Starting generation for "${title}" level=${level} (web: ${webContext.length > 0 ? "yes" : "no"}, sources: ${scrapedPages.length})`);

    // ── Step 1: Generate outline ──
    let outline = await generateOutline(title, courseLang, level, webContext, sourceContext);

    if (!outline || outline.chapters.length < 3) {
      console.log("[generate] Outline failed, trying single-call fallback...");
      const fallbackResult = await generateSingleCall(title, courseLang, level, webContext, sourceContext);
      if (!fallbackResult || fallbackResult.chapters.length === 0) {
        return NextResponse.json({ error: "L'IA n'a pas pu générer un cours valide. Réessaie." }, { status: 500 });
      }
      const course = await saveCourse(title, level, userId, sourceLinks, fallbackResult.description, fallbackResult.chapters, scrapedPages.length);
      return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
    }

    console.log(`[outline] ${outline.chapters.length} chapters planned`);

    // ── Step 2: Generate each chapter individually ──
    const generatedChapters: Array<{ title: string; content: string; summary: string }> = [];

    for (let i = 0; i < outline.chapters.length; i++) {
      const ch = outline.chapters[i];
      let chapter = await generateChapter(title, courseLang, level, i, outline.chapters.length, ch, webContext, sourceContext);

      if (!chapter) {
        console.log(`[chapter-${i + 1}] Failed, retrying without research context...`);
        chapter = await generateChapter(title, courseLang, level, i, outline.chapters.length, ch, "", "");
      }

      if (chapter) {
        const quality = validateChapterQuality(chapter.content, level);
        if (!quality.passed) console.log(`[chapter-${i + 1}] Quality issues: ${quality.issues.join(", ")} (${quality.wordCount} words, ${quality.headingCount} headings)`);
        else console.log(`[chapter-${i + 1}] Quality OK (${quality.wordCount} words, ${quality.headingCount} headings)`);
        generatedChapters.push(chapter);
      } else {
        console.warn(`[chapter-${i + 1}] Completely failed, skipping`);
      }
    }

    if (generatedChapters.length === 0) {
      console.log("[generate] All chapters failed, trying single-call fallback...");
      const fallbackResult = await generateSingleCall(title, courseLang, level, webContext, sourceContext);
      if (!fallbackResult || fallbackResult.chapters.length === 0) {
        return NextResponse.json({ error: "L'IA n'a pas pu générer un cours valide. Réessaie." }, { status: 500 });
      }
      const course = await saveCourse(title, level, userId, sourceLinks, fallbackResult.description, fallbackResult.chapters, scrapedPages.length);
      return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
    }

    console.log(`[generate] Generated ${generatedChapters.length}/${outline.chapters.length} chapters successfully`);

    // ── Step 3: Save ──
    const course = await saveCourse(title, level, userId, sourceLinks, outline.description, generatedChapters, scrapedPages.length);
    return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
  } catch (error: unknown) {
    console.error("Course generation error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate course" }, { status: 500 });
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

async function saveCourse(
  title: string, level: number, userId: string | null, sourceLinks: string[],
  description: string, chapters: Array<{ title: string; content: string; summary: string }>, scrapedCount: number,
) {
  const course = await db.course.create({
    data: {
      title: title.trim(), description, sourceLinks: JSON.stringify(sourceLinks),
      level, flameCost: 0, userId: userId || null,
      chapters: { create: chapters.map((ch, idx) => ({ title: ch.title, content: ch.content, summary: ch.summary, order: idx + 1, level })) },
    },
    include: { chapters: { orderBy: { order: "asc" } } },
  });
  await db.courseProgress.upsert({ where: { courseId: course.id }, create: { courseId: course.id }, update: {} });
  return course;
}

function buildResponse(
  course: { id: string; title: string; description: string; createdAt: Date; chapters: Array<{ id: string; title: string; content: string; summary: string; order: number; level: number }> },
  sourceLinks: string[], scrapedSources: number,
) {
  return {
    success: true, scrapedSources,
    course: {
      id: course.id, title: course.title, description: course.description, sourceLinks, createdAt: course.createdAt,
      chapters: course.chapters.map((ch) => ({ id: ch.id, title: ch.title, content: ch.content, summary: ch.summary, order: ch.order, level: ch.level })),
    },
  };
}
