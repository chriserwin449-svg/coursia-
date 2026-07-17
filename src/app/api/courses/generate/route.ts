import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { smartChatCompletion, classifyAIError } from "@/lib/openai";
import { MAX_SOURCE_LINKS, MAX_TOKENS, MIN_CHAPTERS, MAX_CHAPTERS } from "@/lib/constants";

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN MIGRATION (ensure freeCourseUsed & hasCardOnFile exist)
// ═══════════════════════════════════════════════════════════════════════════

async function migrateColumn(table: string, col: string, colDef: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "${table}" ADD COLUMN "${col}" ${colDef}; EXCEPTION WHEN duplicate_column THEN null; END $$;`
    );
  } catch { /* non-critical */ }
}

async function ensureFreeCourseColumn(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.startsWith("file:")) return; // SQLite: Prisma handles it
  try {
    await migrateColumn("User", "freeCourseUsed", "BOOLEAN NOT NULL DEFAULT false");
    await migrateColumn("User", "hasCardOnFile", "BOOLEAN NOT NULL DEFAULT false");
  } catch { /* non-critical */ }
}

// Vercel serverless function timeout — course generation needs 120s
// (web search + AI outline + 4-6 AI chapter generations)
export const maxDuration = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════
// TIMING & LOGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const timings: Record<string, number> = {};

function logStep(step: string) {
  const now = Date.now();
  timings[step] = now;
  console.log(`[generate][${step}] ── ${new Date().toISOString()}`);
}

function logDuration(from: string, to: string) {
  const start = timings[from];
  const end = timings[to] || Date.now();
  if (start) {
    console.log(`[generate][timing] ${from} → ${to}: ${((end - start) / 1000).toFixed(1)}s`);
  }
}

/**
 * Retry with exponential backoff: 1s, 2s, 4s (3 attempts)
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRetryable = msg.includes("429") || msg.includes("timeout") || msg.includes("ECONNRESET")
        || msg.includes("ETIMEDOUT") || msg.includes("socket") || msg.includes("fetch failed")
        || msg.includes("502") || msg.includes("503") || msg.includes("500");

      if (attempt < retries && isRetryable) {
        const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
        console.log(`[retry] Attempt ${attempt + 1} failed (${msg.slice(0, 120)}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
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
  } catch {
    return "";
  }
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

  // 5 parallel searches from different angles for richer, more accurate content
  const [r1, r2, r3, r4, r5] = await Promise.all([
    searchOnce(zai, `${topic} ${levelContext} explained ${langQ}`),
    searchOnce(zai, `${topic} real world examples case studies applications ${langQ}`),
    searchOnce(zai, `${topic} common mistakes misconceptions pitfalls ${langQ}`),
    searchOnce(zai, `${topic} latest advances 2025 trends future ${langQ}`),
    searchOnce(zai, `best resources learn ${topic} ${courseLang === "en" ? "2025" : "2025"} ${langQ}`),
  ]);

  const blocks: string[] = [];
  if (r1) blocks.push(`══ CONCEPTS & EXPLANATIONS ══\n${r1}`);
  if (r2) blocks.push(`══ REAL-WORLD EXAMPLES & CASES ══\n${r2}`);
  if (r3) blocks.push(`══ COMMON MISTAKES & MISCONCEPTIONS ══\n${r3}`);
  if (r4) blocks.push(`══ LATEST ADVANCES & TRENDS (2025) ══\n${r4}`);
  if (r5) blocks.push(`══ BEST RESOURCES & REFERENCES ══\n${r5}`);

  const combined = blocks.join("\n\n");
  const totalResults = [r1, r2, r3, r4, r5].filter(Boolean).length;
  console.log(`[search] Deep search completed: ${totalResults}/5 queries returned results (${combined.length} chars)`);

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
- Dernières avancées de la recherche (2024-2025).
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

NOMBRE DE CHAPITRES OBLIGATOIRE : entre ${MIN_CHAPTERS} et ${MAX_CHAPTERS} chapitres. Pas moins de ${MIN_CHAPTERS}, pas plus de ${MAX_CHAPTERS}.
Chaque chapitre DOIT être substantiel et couvrir un aspect distinct du sujet.

RÈGLES ABSOLUES :
1. PROGRESSION : chaque chapitre construit sur le précédent. Ordre logique, pas aléatoire.
2. PROFONDEUR : chaque chapitre doit contenir au moins 3 sous-sections distinctes.
3. CONCRET : chaque chapitre doit avoir au moins 1 cas réel ou exemple précis (noms, chiffres, situations).
4. ANALOGIES : variées (cuisine, sport, musique, finance, nature, technologie, santé...).
5. ANCRAGE RECHERCHE : intègre les données de recherche ci-dessus comme faits vérifiables. Privilégie les données 2024-2025. Chaque chapitre doit s'appuyer sur au moins 1 fait réel de la recherche.

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
  console.log(`[outline] Generating outline for "${title}" (level=${level}, lang=${courseLang})...`);
  const completion = await smartChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: courseLang === "en"
      ? `Design the detailed outline for a level ${level} course (${MIN_CHAPTERS}-${MAX_CHAPTERS} chapters) on: ${title}`
      : `Conçois le plan détaillé du cours de niveau ${level} (${MIN_CHAPTERS}-${MAX_CHAPTERS} chapitres) sur : ${title}` },
  ], { maxTokens: 4096, temperature: 0.5 });

  const text = completion.content || "";
  console.log(`[outline] Response: ${text.length} chars, provider: ${completion.provider}`);
  if (!text) {
    console.warn("[outline] Empty response from AI");
    return null;
  }
  return extractOutline(text);
}

function extractOutline(text: string): OutlineResult | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  // Strategy 1: Direct JSON parse (ideal case — handles complete valid JSON)
  try {
    const data = JSON.parse(cleaned) as Record<string, unknown>;
    if (data.chapters && Array.isArray(data.chapters)) {
      const parsed = parseOutlineData(data);
      if (parsed && parsed.chapters.length > 0) return parsed;
    }
  } catch { /* not valid JSON directly, continue */ }

  // Strategy 2: Brace-matching extraction (for JSON embedded in text)
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

  const tryParse = (s: string): OutlineResult | null => {
    try {
      const data = JSON.parse(s) as Record<string, unknown>;
      return parseOutlineData(data);
    } catch { return null; }
  };

  const result = tryParse(snippet)
    || tryParse(snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'"));

  if (result) return result;

  // Strategy 3: Extract chapter titles from partial/truncated JSON
  return extractChaptersFromPartialJSON(snippet);
}

function parseOutlineData(data: Record<string, unknown>): OutlineResult | null {
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
}

/** Extract as many chapter outlines as possible from potentially truncated JSON */
function extractChaptersFromPartialJSON(text: string): OutlineResult | null {
  const chapterBlockRegex = /\{\s*"title"\s*:\s*"([^"]{5,200})"\s*,\s*"goal"\s*:\s*"([^"]*)"/g;
  const matches: { title: string; goal: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = chapterBlockRegex.exec(text)) !== null) {
    matches.push({ title: m[1], goal: m[2] });
  }
  if (matches.length === 0) return null;

  const descMatch = text.match(/"description"\s*:\s*"([^"]{10,500})"/);
  const description = descMatch ? descMatch[1] : "";

  const chapters: OutlineChapter[] = matches.map((match) => ({
    title: match.title,
    goal: match.goal,
    keyConcepts: [],
    subSections: [],
    plannedAnalogy: "",
    plannedCaseStudy: "",
    plannedExample: "",
    mythToBust: "",
    reflectionQuestion: "",
    realAction: "",
    expertNote: "",
  }));

  console.log(`[outline] Extracted ${chapters.length} chapters from partial JSON`);
  return chapters.length > 0 ? { description, chapters } : null;
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
RÈGLE CRITIQUE : Les données de recherche ci-dessus sont TA source de vérité. 
- Utilise systématiquement les faits, chiffres, noms et exemples trouvés dans ces données.
- Si les données contiennent des statistiques, cite-les PRECISÉMENT (source, année, pourcentage).
- N'invente JAMAIS de statistiques ou de faits. Préfère citer un chiffre réel qu'en inventer un.
- Si les données couvrent un aspect du chapitre, construis ton contenu AUTOUR de ces données réelles.
- Intègre les informations les plus récentes (2024-2025) en priorité.`;
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
  if (!text) {
    console.warn(`[chapter-${chapterIdx + 1}] Empty response`);
    return null;
  }
  return extractChapter(text);
}

function extractChapter(text: string): { title: string; content: string; summary: string } | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  // Strategy 1: Direct JSON parse
  const tryParse = (s: string) => {
    try {
      const data = JSON.parse(s) as Record<string, unknown>;
      if (typeof data.title === "string" && data.title.trim() && typeof data.content === "string" && data.content.trim()) {
        return { title: data.title.trim(), content: data.content.trim(), summary: typeof data.summary === "string" ? data.summary.trim() : "" };
      }
    } catch { /* continue */ }
    return null;
  };

  let result = tryParse(cleaned);
  if (result) return result;

  // Strategy 2: Brace-matching extraction
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

  result = tryParse(snippet)
    || tryParse(snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'"));

  if (result) return result;

  // Strategy 3: Extract title + content from partial JSON (e.g., truncated by token limit)
  const titleMatch = cleaned.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const contentMatch = cleaned.match(/"content"\s*:\s*"((?:[^"\\]|\\.|[\s\S])*?)(?:"\s*(?:,|\}|$))/);
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);

  if (titleMatch && contentMatch) {
    let content = contentMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    // Ensure content has at least one heading
    if (content.includes("##")) {
      console.log(`[extractChapter] Recovered chapter from partial JSON: "${titleMatch[1].slice(0, 50)}..."`);
      return {
        title: titleMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        content,
        summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "",
      };
    }
  }

  return null;
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
   EMERGENCY: Minimal chapter generation (when full prompt fails twice)
   ═══════════════════════════════════════════════════════════════════════════ */

async function generateChapterEmergency(
  courseTitle: string, courseLang: string, level: number,
  chapterIdx: number, totalChapters: number, outline: OutlineChapter,
): Promise<{ title: string; content: string; summary: string } | null> {
  const langNote = courseLang === "en" ? "Write in English." : "Écris en français.";
  const levelLabel = level === 0 ? "beginner" : level === 1 ? "intermediate" : "advanced";

  const completion = await smartChatCompletion([
    { role: "system", content: `You are a teacher. ${langNote} Level: ${levelLabel}. Respond ONLY with valid JSON, no markdown.` },
    { role: "user", content: `Write chapter ${chapterIdx + 1} of ${totalChapters} for a course on "${courseTitle}".\nChapter title: "${outline.title}"\nGoal: ${outline.goal}\n\nRespond ONLY with: {"title":"...","content":"## Section 1\\nContent\\n\\n## Section 2\\nContent\\n\\n## Key Takeaways\\nSummary","summary":"One sentence summary"}\n\nThe content must be at least 400 words with proper ## headings.` },
  ], { maxTokens: 4096, temperature: 0.6 });

  const text = completion.content || "";
  console.log(`[emergency-chapter-${chapterIdx + 1}] ${text.length} chars, provider: ${completion.provider}`);
  if (!text) return null;
  return extractChapter(text);
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
    { role: "user", content: `Crée un cours de niveau ${level} (${MIN_CHAPTERS}-${MAX_CHAPTERS} chapitres OBLIGATOIRES, pas moins de ${MIN_CHAPTERS}) sur : ${title}` },
  ], { maxTokens: MAX_TOKENS, temperature: 0.7 });

  const text = completion.content || "";
  console.log(`[fallback] ${text.length} chars, provider: ${completion.provider}`);
  if (!text) {
    console.warn("[fallback] Empty response");
    return null;
  }
  return extractFallbackCourse(text);
}

function extractFallbackCourse(text: string): { description: string; chapters: Array<{ title: string; content: string; summary: string }> } | null {
  let cleaned = text.trim();
  const cb = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (cb) cleaned = cb[1].trim();

  // Strategy 1: Direct parse
  const tryParse = (s: string) => {
    try {
      const data = JSON.parse(s) as Record<string, unknown>;
      return parseFallbackData(data);
    } catch { return null; }
  };

  let result = tryParse(cleaned);
  if (result && result.chapters.length >= MIN_CHAPTERS) return result;

  // Strategy 2: Brace-matching
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) return result;

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

  const parsed = tryParse(snippet)
    || tryParse(snippet.replace(/,\s*([}\]])/g, "$1").replace(/[\u201C\u201D\u2018\u2019]/g, "'"));

  if (parsed && (!result || parsed.chapters.length > result.chapters.length)) result = parsed;

  return result;
}

function parseFallbackData(data: Record<string, unknown>): { description: string; chapters: Array<{ title: string; content: string; summary: string }> } | null {
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
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logStep("start");

  try {
    // ── Parse and validate input ──
    let body: { title?: string; sourceLinks?: string[]; level?: number; courseLang?: string; userId?: string };
    try {
      body = await request.json();
    } catch {
      console.error("[generate] Invalid JSON body");
      return NextResponse.json({ error: "INVALID_INPUT", message: "Invalid request body" }, { status: 400 });
    }

    const { title, sourceLinks = [], level = 0, courseLang = "en", userId: rawUserId } = body;
    const userId: string | null = rawUserId || null;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      console.warn("[generate] Missing or empty title");
      return NextResponse.json({ error: "INVALID_INPUT", message: "Title is required" }, { status: 400 });
    }

    if (!["fr", "en"].includes(courseLang)) {
      console.warn(`[generate] Invalid courseLang: ${courseLang}`);
      return NextResponse.json({ error: "INVALID_INPUT", message: "Invalid language" }, { status: 400 });
    }

    if (typeof level !== "number" || level < 0 || level > 2) {
      console.warn(`[generate] Invalid level: ${level}`);
      return NextResponse.json({ error: "INVALID_INPUT", message: "Invalid level" }, { status: 400 });
    }

    console.log(`[generate] ═══ VALIDATION OK ═══ title="${title.trim()}" level=${level} lang=${courseLang} userId=${userId || 'anonymous'} links=${sourceLinks.length}`);

    // ── CRITICAL: Free course abuse prevention (atomic, race-condition-safe) ──
    // Single source of truth: User.freeCourseUsed boolean in the database.
    // This flag is NEVER reset, even if the course is deleted.
    // We use an interactive transaction to atomically check + claim the free slot.
    if (userId) {
      // Ensure column exists BEFORE the transaction (especially for PostgreSQL)
      await ensureFreeCourseColumn();

      let freeSlotClaimed = false;
      try {
        let canGenerate = false;
        await db.$transaction(async (tx) => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { subscriptionStatus: true, freeCourseUsed: true },
          });
          // Active subscription → always allow
          if (user?.subscriptionStatus === "active") {
            canGenerate = true;
            return;
          }
          // Free course already used → BLOCK
          if (user?.freeCourseUsed) {
            canGenerate = false;
            return;
          }
          // First free course → claim the slot ATOMICALLY (prevents race conditions)
          await tx.user.update({
            where: { id: userId },
            data: { freeCourseUsed: true },
          });
          canGenerate = true;
          freeSlotClaimed = true;
        });
        if (!canGenerate) {
          console.log(`[generate] Free limit reached for user ${userId}: freeCourseUsed=true, subscription not active`);
          return NextResponse.json({ error: "FREE_LIMIT", requiresSubscription: true }, { status: 403 });
        }
        console.log(`[generate] User quota OK: freeCourseUsed now claimed for user ${userId}`);
      } catch (dbError) {
        const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
        console.error("[generate] DB error checking quota:", errMsg);
        // FAIL-OPEN: if we can't check the quota, allow generation.
        // The atomic check is a safety net, not a hard requirement.
        // Logging is present to monitor and catch abusers.
        console.warn(`[generate] Proceeding with generation despite DB quota error (fail-open) for user ${userId}`);
      }
    }

    // ── Step 0: Deep web search + source scraping (parallel) ──
    logStep("search_start");
    let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
    let webContext = "";
    let scrapedPages: ScrapedPage[] = [];

    try {
      zaiInstance = await ZAI.create();

      // Warm-up call to prime the SDK connection (prevents cold-start failures)
      try {
        console.log("[generate] Warming up SDK connection...");
        await zaiInstance.functions.invoke("web_search", { query: "warmup", num: 1 });
        console.log("[generate] SDK warm-up successful");
      } catch {
        console.log("[generate] SDK warm-up failed (non-critical, continuing)");
      }

      const [searchResults, scraped] = await Promise.all([
        deepSearch(zaiInstance, title, courseLang, level),
        sourceLinks.length > 0 ? scrapeSourceLinks(zaiInstance, sourceLinks) : Promise.resolve([]),
      ]);
      webContext = searchResults;
      scrapedPages = scraped;
    } catch (err) {
      console.warn("[generate] z-ai SDK unavailable, skipping search/scraping:", err instanceof Error ? err.message : err);
    }

    const sourceContext = buildSourceContext(scrapedPages);
    logStep("search_end");
    logDuration("search_start", "search_end");
    console.log(`[generate] Search phase complete: web=${webContext.length > 0 ? webContext.length + 'chars' : 'none'}, sources=${scrapedPages.length}`);

    // ── Step 1: Generate outline (with retry) ──
    logStep("outline_start");
    let outline: OutlineResult | null = null;
    let outlineError: unknown = null;

    try {
      outline = await withRetry(() => generateOutline(title, courseLang, level, webContext, sourceContext), 2);
    } catch (error) {
      outlineError = error;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[generate] Outline all retries failed (${msg.slice(0, 150)}), trying without research context...`);
      try {
        outline = await generateOutline(title, courseLang, level, "", "");
      } catch (retryErr) {
        console.error("[generate] Outline retry without context also failed:", retryErr instanceof Error ? retryErr.message : retryErr);
      }
    }

    logStep("outline_end");
    logDuration("outline_start", "outline_end");

    console.log(`[outline] Outline has ${outline.chapters.length} chapters, need at least ${MIN_CHAPTERS}`);
    if (outline.chapters.length < MIN_CHAPTERS) {
      console.log("[generate] Outline failed or too few chapters, trying single-call fallback...");
      logStep("fallback_start");
      const fallbackResult = await generateSingleCall(title, courseLang, level, webContext, sourceContext);
      logStep("fallback_end");
      logDuration("fallback_start", "fallback_end");

      if (!fallbackResult || fallbackResult.chapters.length === 0) {
        console.error("[generate] ALL GENERATION METHODS FAILED");
        const errType = outlineError ? classifyAIError(outlineError) : "UNKNOWN";
        return NextResponse.json({
          error: "AI_GENERATION_FAILED",
          message: "The AI could not generate a valid course structure. This is usually temporary.",
          errorType: errType,
        }, { status: 500 });
      }
      console.log(`[generate] Fallback succeeded: ${fallbackResult.chapters.length} chapters`);
      const course = await saveCourse(title, level, userId, sourceLinks, fallbackResult.description, fallbackResult.chapters, scrapedPages.length);
      logStep("save_end");
      logDuration("start", "save_end");
      console.log(`[generate] ═══ TOTAL TIME: ${((Date.now() - startTime) / 1000).toFixed(1)}s ═══`);
      return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
    }

    console.log(`[outline] ${outline.chapters.length} chapters planned`);

    // ── Step 2: Generate each chapter individually ──
    logStep("chapters_start");
    let generatedChapters: Array<{ title: string; content: string; summary: string }> = [];

    for (let i = 0; i < outline.chapters.length; i++) {
      const ch = outline.chapters[i];
      console.log(`[generate] ── Chapter ${i + 1}/${outline.chapters.length}: "${ch.title}" ──`);
      const chStart = Date.now();

      // Attempt 1: Full prompt with research context
      let chapter = await withRetry(
        () => generateChapter(title, courseLang, level, i, outline.chapters.length, ch, webContext, sourceContext),
        1, // 1 retry (2 attempts total)
      );

      // Attempt 2: Without research context (smaller prompt = faster, less likely to fail)
      if (!chapter) {
        console.log(`[chapter-${i + 1}] Attempt 1 failed, trying without research context...`);
        chapter = await withRetry(
          () => generateChapter(title, courseLang, level, i, outline.chapters.length, ch, "", ""),
          1,
        );
      }

      // Attempt 3: Minimal emergency prompt — just asks for raw content, no fancy structure
      if (!chapter) {
        console.log(`[chapter-${i + 1}] Attempt 2 failed, trying minimal emergency prompt...`);
        chapter = await generateChapterEmergency(title, courseLang, level, i, outline.chapters.length, ch);
      }

      if (chapter) {
        const quality = validateChapterQuality(chapter.content, level);
        if (!quality.passed) console.log(`[chapter-${i + 1}] Quality issues: ${quality.issues.join(", ")} (${quality.wordCount} words, ${quality.headingCount} headings)`);
        else console.log(`[chapter-${i + 1}] Quality OK (${quality.wordCount} words, ${quality.headingCount} headings)`);
        generatedChapters.push(chapter);
      } else {
        console.error(`[chapter-${i + 1}] ALL 3 ATTEMPTS FAILED — chapter will be missing!`);
      }

      console.log(`[chapter-${i + 1}] Time: ${((Date.now() - chStart) / 1000).toFixed(1)}s`);
    }

    // ── Safety net: if fewer than MIN_CHAPTERS were generated, try single-call fallback ──
    if (generatedChapters.length < MIN_CHAPTERS) {
      console.log(`[generate] Only ${generatedChapters.length}/${outline.chapters.length} chapters generated (need ${MIN_CHAPTERS}). Trying single-call fallback...`);
      logStep("fallback2_start");
      const fallbackResult = await generateSingleCall(title, courseLang, level, webContext, sourceContext);
      logStep("fallback2_end");

      if (fallbackResult && fallbackResult.chapters.length > generatedChapters.length) {
        console.log(`[generate] Fallback produced ${fallbackResult.chapters.length} chapters (better than ${generatedChapters.length}), using fallback result`);
        generatedChapters = fallbackResult.chapters;
        // Use fallback description if it's better
        if (fallbackResult.description && fallbackResult.description.length > (outline.description?.length || 0)) {
          outline.description = fallbackResult.description;
        }
      } else if (fallbackResult) {
        console.log(`[generate] Fallback produced only ${fallbackResult.chapters.length} chapters (not better), keeping original ${generatedChapters.length}`);
      } else {
        console.warn(`[generate] Single-call fallback also failed`);
      }
    }

    if (generatedChapters.length === 0) {
      console.error("[generate] ALL GENERATION METHODS FAILED — no chapters at all");
      return NextResponse.json({
        error: "AI_GENERATION_FAILED",
        message: "The AI could not generate any course chapters. Please try again.",
      }, { status: 500 });
    }

    console.log(`[generate] Generated ${generatedChapters.length}/${outline.chapters.length} chapters successfully`);
    logStep("chapters_end");
    logDuration("chapters_start", "chapters_end");

    // ── Step 3: Save ──
    logStep("save_start");
    const course = await saveCourse(title, level, userId, sourceLinks, outline.description, generatedChapters, scrapedPages.length);
    logStep("save_end");
    logDuration("save_start", "save_end");
    logDuration("start", "save_end");
    console.log(`[generate] ═══ COURSE GENERATED SUCCESSFULLY in ${((Date.now() - startTime) / 1000).toFixed(1)}s ═══`);
    console.log(`[generate] Course ID: ${course.id}, Chapters: ${course.chapters.length}`);
    return NextResponse.json(buildResponse(course, sourceLinks, scrapedPages.length));
  } catch (error: unknown) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const msg = error instanceof Error ? error.message : String(error);
    const errorType = classifyAIError(error);
    console.error(`[generate] ═══ UNHANDLED ERROR after ${duration}s ═══`);
    console.error(`[generate] Error type: ${errorType}`);
    console.error(`[generate] Error message: ${msg}`);
    console.error(error);

    return NextResponse.json({
      error: "GENERATION_ERROR",
      message: `Course generation failed: ${msg.slice(0, 200)}`,
      errorType,
    }, { status: 500 });
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

  // freeCourseUsed is now set atomically BEFORE generation starts (in the main POST handler)
  // No need to set it here again.

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