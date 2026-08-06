import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { smartChatCompletion, classifyAIError, AllProvidersFailedError, getZAI } from "@/lib/openai";
import { MAX_SOURCE_LINKS, MAX_TOKENS, MIN_CHAPTERS, MAX_CHAPTERS } from "@/lib/constants";
import { isAdmin } from "@/lib/admin";

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
  zai: Awaited<ReturnType<typeof getZAI>>,
  query: string,
): Promise<string> {
  try {
    const results = await zai.invokeFunction("web_search", { query, num: 5 });
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
  zai: Awaited<ReturnType<typeof getZAI>> | null,
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

async function scrapeSourceLinks(zai: Awaited<ReturnType<typeof getZAI>>, sourceLinks: string[]): Promise<ScrapedPage[]> {
  const results: ScrapedPage[] = [];
  for (let i = 0; i < Math.min(sourceLinks.length, MAX_SOURCE_LINKS); i++) {
    const url = sourceLinks[i];
    if (!url?.startsWith("http")) continue;
    try {
      const result = await zai.invokeFunction("page_reader", { url });
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

/* ═══════════════════════════════════════════════════════════════════════════
   BILINGUAL PROMPT STRINGS — returns all language-dependent prompt text
   ═══════════════════════════════════════════════════════════════════════════ */

function getPromptStrings(lang: string) {
  const en = lang === "en";

  return {
    langLabel: en ? "english" : "français",

    // ── Outline system prompt ──
    outline: {
      role: en
        ? "You are a world-class instructional designer. You create courses that are references in their field."
        : "Tu es un architecte pédagogique d'élite mondiale. Tu conçois des cours qui sont références dans leur domaine.",
      subjectLabel: en ? "SUBJECT" : "SUJET",
      languageLabel: en ? "LANGUAGE" : "LANGUE",
      langNote: en ? "Write EVERYTHING in English." : "Rédige TOUT en français.",
      levelDesc: [
        en
          ? `BEGINNER (level 1):\n- Zero prerequisite knowledge. Start from absolute ZERO.\n- Every technical term must be defined IMMEDIATELY.\n- Ultra-simple analogies, everyday examples.\n- Very progressive pace: one concept at a time, locked in before moving on.\n- Goal: make the reader AUTONOMOUS on the basics of the subject.`
          : `DÉBUTANT (niveau 1) :\n- Zéro présupposé de connaissances. Tu pars du ZÉRO absolu.\n- Chaque terme technique doit être défini IMMÉDIATEMENT.\n- Analogies ultra-simples, exemples du quotidien.\n- Rythme très progressif : un concept à la fois, bien verrouillé avant le suivant.\n- Objectif : rendre le lecteur AUTONOME sur les bases du sujet.`,
        en
          ? `INTERMEDIATE (level 2):\n- The reader knows the basics. Build ON those basics.\n- Technical vocabulary allowed but always explained in context.\n- Professional examples, real use cases, hard data.\n- Introduce nuance: "it depends on...", "in some cases...", "the classic trap is..."\n- Compare approaches, frameworks, schools of thought.\n- Goal: make the reader CAPABLE of applying the subject in their profession.`
          : `INTERMÉDIAIRE (niveau 2) :\n- Le lecteur connaît les bases. Tu construis SUR ces bases.\n- Vocabulaire technique autorisé mais toujours expliqué en contexte.\n- Exemples professionnels, cas d'usage réels, données chiffrées.\n- Introduis la nuance : "ça dépend de...", "dans certains cas...", "le piège classique c'est..."\n- Compare les approches, les frameworks, les écoles de pensée.\n- Objectif : rendre le lecteur CAPABLE d'appliquer le sujet dans son métier.`,
        en
          ? `ADVANCED (level 3):\n- The reader is already competent. Make them an EXPERT.\n- Edge cases, paradoxes, exceptions to the rules.\n- Latest research advances (2024-2025).\n- Current debates among domain experts — present both sides.\n- Challenge certainties: "What you thought you knew..."\n- Critical analysis, multi-perspective, second-order thinking.\n- Goal: give the reader a COMPETITIVE ADVANTAGE through deep understanding.`
          : `AVANCÉ (niveau 3) :\n- Le lecteur est déjà compétent. Tu le rends EXPERT.\n- Cas limites, paradoxes, edge cases, exceptions aux règles.\n- Dernières avancées de la recherche (2024-2025).\n- Débats actuels entre experts du domaine — présente les deux camps.\n- Remets en question les certitudes : "Ce que vous pensiez savoir..."\n- Analyse critique, multi-perspectives, pensée de second ordre.\n- Objectif : donner au lecteur un AVANTAGE COMPÉTITIF par sa compréhension profonde.`,
      ],
      researchHeader: en ? "═══ RESEARCH DATA (use it to enrich the outline) ═══" : "═══ DONNÉES DE RECHERCHE (utilise-les pour enrichir le plan) ═══",
      noData: en ? "No data available." : "Aucune donnée disponible.",
      researchFooter: en ? "═══ END OF RESEARCH DATA ═══" : "═══ FIN DES DONNÉES DE RECHERCHE ═══",
      missionHeader: en ? "═══ YOUR MISSION ═══" : "═══ TA MISSION ═══",
      missionText: (level: number) => en
        ? `Create a level ${level} course outline that covers the subject with depth and rigor.\nThe outline must be detailed enough for another expert to teach from it.`
        : `Crée un plan de cours de niveau ${level} qui couvre le sujet avec profondeur et rigueur.\nLe plan doit être suffisamment détaillé pour qu'un autre expert puisse l'enseigner.`,
      chapterCountRule: (min: number, max: number) => en
        ? `MANDATORY CHAPTER COUNT: between ${min} and ${max} chapters. No fewer than ${min}, no more than ${max}.\nEach chapter MUST be substantial and cover a distinct aspect of the subject.`
        : `NOMBRE DE CHAPITRES OBLIGATOIRE : entre ${min} et ${max} chapitres. Pas moins de ${min}, pas plus de ${max}.\nChaque chapitre DOIT être substantiel et couvrir un aspect distinct du sujet.`,
      absoluteRules: en
        ? `ABSOLUTE RULES:\n1. PROGRESSION: each chapter builds on the previous. Logical order, not random.\n2. DEPTH: each chapter must contain at least 3 distinct sub-sections.\n3. CONCRETE: each chapter must have at least 1 real case or specific example (names, figures, situations).\n4. ANALOGIES: varied (cooking, sports, music, finance, nature, technology, health...).\n5. RESEARCH ANCHORING: integrate the research data above as verifiable facts. Prioritize 2024-2025 data. Each chapter must rely on at least 1 real research fact.`
        : `RÈGLES ABSOLUES :\n1. PROGRESSION : chaque chapitre construit sur le précédent. Ordre logique, pas aléatoire.\n2. PROFONDEUR : chaque chapitre doit contenir au moins 3 sous-sections distinctes.\n3. CONCRET : chaque chapitre doit avoir au moins 1 cas réel ou exemple précis (noms, chiffres, situations).\n4. ANALOGIES : variées (cuisine, sport, musique, finance, nature, technologie, santé...).\n5. ANCRAGE RECHERCHE : intègre les données de recherche ci-dessus comme faits vérifiables. Privilégie les données 2024-2025. Chaque chapitre doit s'appuyer sur au moins 1 fait réel de la recherche.`,
      jsonOnly: en ? "Respond ONLY with this valid JSON:" : "Réponds UNIQUEMENT avec ce JSON valide :",
      jsonExample: (level: number) => en
        ? `{\n  "description": "A captivating 2-3 sentence description of the course that immediately makes you want to start",\n  "chapters": [\n    {\n      "title": "Precise chapter title",\n      "goal": "What the reader will master precisely after this chapter (1 sentence)",\n      "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],\n      "subSections": ["Sub-section A", "Sub-section B", "Sub-section C"],\n      "plannedAnalogy": "Concrete, familiar and original analogy for the chapter's main concept",\n      "plannedCaseStudy": "Real case or specific example with context (company, person, situation, figures)",\n      "plannedExample": "Specific numerical example (amounts, percentages, durations, comparisons)",\n      "mythToBust": "A common misconception this chapter will destroy with evidence",\n      "reflectionQuestion": "Deep reflection question that forces the reader to truly think",\n      "realAction": "Concrete action immediately applicable in the reader's life/profession",\n      "expertNote": "${level >= 2 ? "Expert note, nuance or insight that only a professional would understand" : ""}"\n    }\n  ]\n}`
        : `{\n  "description": "Description captivante du cours en 2-3 phrases qui donne immédiatement envie de commencer",\n  "chapters": [\n    {\n      "title": "Titre précis du chapitre",\n      "goal": "Ce que le lecteur maîtrisera précisément après ce chapitre (1 phrase)",\n      "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],\n      "subSections": ["Sous-section A", "Sous-section B", "Sous-section C"],\n      "plannedAnalogy": "Analogie concrète, familière et originale pour le concept principal du chapitre",\n      "plannedCaseStudy": "Cas réel ou exemple précis avec contexte (entreprise, personne, situation, chiffres)",\n      "plannedExample": "Exemple chiffré et spécifique (montants, pourcentages, durées, comparaisons)",\n      "mythToBust": "Une idée reçue que ce chapitre détruira avec des preuves",\n      "reflectionQuestion": "Question de réflexion profonde qui force le lecteur à vraiment penser",\n      "realAction": "Action concrète applicable immédiatement dans la vie/vie professionnelle du lecteur",\n      "expertNote": "${level >= 2 ? "Note experte, nuance ou insight que seul un professionnel comprendrait" : ""}"\n    }\n  ]\n}`,
      userPrompt: (level: number, title: string) => en
        ? `Design the detailed outline for a level ${level} course (${MIN_CHAPTERS}-${MAX_CHAPTERS} chapters) on: ${title}`
        : `Conçois le plan détaillé du cours de niveau ${level} (${MIN_CHAPTERS}-${MAX_CHAPTERS} chapitres) sur : ${title}`,
    },

    // ── Chapter system prompt ──
    chapter: {
      role: en
        ? "You are an exceptional teacher, capable of making the most complex subjects both accessible AND deep."
        : "Tu es un professeur d'exception, capable de rendre les sujets les plus complexes accessibles ET profonds à la fois.",
      langNote: en ? "Write EVERYTHING in English." : "Rédige l'INTÉGRALITÉ en français.",
      researchHeader: en ? "═══ RESEARCH DATA ═══" : "═══ DONNÉES DE RECHERCHE ═══",
      researchFooter: en ? "═══ END OF DATA ═══" : "═══ FIN DES DONNÉES ═══",
      researchRules: en
        ? `CRITICAL RULE: The research data above is YOUR source of truth.\n- Systematically use the facts, figures, names and examples found in this data.\n- If the data contains statistics, cite them PRECISELY (source, year, percentage).\n- NEVER invent statistics or facts. Prefer citing a real figure over inventing one.\n- If the data covers an aspect of the chapter, build your content AROUND this real data.\n- Prioritize the most recent information (2024-2025).`
        : `RÈGLE CRITIQUE : Les données de recherche ci-dessus sont TA source de vérité.\n- Utilise systématiquement les faits, chiffres, noms et exemples trouvés dans ces données.\n- Si les données contiennent des statistiques, cite-les PRECISÉMENT (source, année, pourcentage).\n- N'invente JAMAIS de statistiques ou de faits. Préfère citer un chiffre réel qu'en inventer un.\n- Si les données couvrent un aspect du chapitre, construis ton contenu AUTOUR de ces données réelles.\n- Intègre les informations les plus récentes (2024-2025) en priorité.`,
      contextHeader: en ? "═══ CONTEXT ═══" : "═══ CONTEXTE ═══",
      courseLabel: en ? "Course" : "Cours",
      languageLabel: en ? "Language" : "Langue",
      levelLabel: en ? "Level" : "Niveau",
      levelValues: [en ? "Beginner" : "Débutant", en ? "Intermediate" : "Intermédiaire", en ? "Advanced" : "Avancé"],
      chapterOf: (idx: number, total: number) => en ? `Chapter ${idx} of ${total}` : `Chapitre ${idx} sur ${total}`,
      planHeader: en ? "═══ CHAPTER OUTLINE ═══" : "═══ PLAN DE CE CHAPITRE ═══",
      titleLabel: en ? "Title" : "Titre",
      goalLabel: en ? "Goal" : "Objectif",
      conceptsLabel: en ? "Concepts" : "Concepts",
      subsectionsLabel: en ? "Planned subsections" : "Sous-sections prévues",
      analogyLabel: en ? "Planned analogy" : "Analogie prévue",
      caseStudyLabel: en ? "Planned case study" : "Cas d'étude prévu",
      exampleLabel: en ? "Planned numerical example" : "Exemple chiffré prévu",
      mythLabel: en ? "Myth to bust" : "Mythe à détruire",
      reflectionLabel: en ? "Reflection question" : "Question de réflexion",
      actionLabel: en ? "Concrete action" : "Action concrète",
      expertNoteLabel: en ? "Expert note" : "Note experte",

      headings: {
        understanding: en ? "What You'll Understand" : "Ce que tu vas comprendre",
        whyCrucial: en ? "Why This Chapter Matters" : "Pourquoi ce chapitre est crucial",
        fundamentals: en ? "The Fundamentals" : "Les fondamentaux",
        caseStudy: en ? "Case Study" : "Cas d'étude",
        misconceptions: en ? "What Most People Get Wrong" : "Ce que beaucoup de gens se trompent",
        reflect: en ? "Think About It" : "Réfléchis",
        action: en ? "What You Can Do Right Now" : "Ce que tu peux faire dès maintenant",
      },
      summaryInstruction: en
        ? "One-sentence summary of what the reader now masters"
        : "Résumé en une phrase de ce que le lecteur maîtrise maintenant",

      structureHeader: en
        ? "═══ MANDATORY STRUCTURE (use exactly these ## headings) ═══"
        : "═══ STRUCTURE OBLIGATOIRE (utilise exactement ces ## headings) ═══",
      understandingInstr: en
        ? "Open with ONE question or ONE surprising fact that immediately creates the desire to continue.\nThe reader MUST be hooked in the first 3 lines."
        : "Ouvre avec UNE question ou UN fait surprenant qui provoque immédiatement l'envie de continuer.\nLe lecteur DOIT être accroché dans les 3 premières lignes.",
      whyCrucialInstr: en
        ? "Connect this chapter to the overall journey. Show IMMEDIATE value.\nWhy now? Why is this chapter essential for what comes next?"
        : "Connecte ce chapitre au parcours global. Montre la valeur IMMÉDIATE.\nPourquoi maintenant ? Pourquoi ce chapitre est indispensable pour la suite ?",
      fundamentalsPrefix: en ? "For EACH concept" : "Pour CHAQUE concept",
      fundamentalsOrder: (level: number) => en
        ? `1. Clear definition (2-3 sentences, everyday words${level >= 1 ? " then technical translation" : ""})\n2. Immediate and SPECIFIC example (not theoretical — names, places, amounts, situations)\n3. Familiar analogy\n4. ${level >= 1 ? "How an expert thinks about this concept (nuance, exception, trap)" : "Common mistake to avoid"}\n5. ${level >= 2 ? "Comparison with an alternative approach or competing framework" : ""}`
        : `1. Définition claire (2-3 phrases, mots de tous les jours${level >= 1 ? " puis traduction technique" : ""})\n2. Exemple immédiat et PRÉCIS (pas théorique — noms, lieux, montants, situations)\n3. Analogie familière\n4. ${level >= 1 ? "Comment un expert pense à ce concept (nuance, exception, piège)" : "Erreur courante à éviter"}\n5. ${level >= 2 ? "Comparaison avec une approche alternative ou un framework concurrent" : ""}`,
      blockquoteInstr: en
        ? "> [You MUST insert a blockquote with the most important insight]"
        : "> [Insère OBLIGATOIREMENT un blockquote avec l'insight le plus important]",
      caseStudyInstr: (caseStudy: string) => en
        ? `## Case Study: ${caseStudy}\nAnalyze a real case in depth:\n- Context and stakes\n- Approach used and why\n- Measured results\n- Key takeaways\n- How the reader can apply the same approach`
        : `## Cas d'étude : ${caseStudy}\nAnalyse un cas réel en profondeur :\n- Contexte et enjeux\n- Approche utilisée et pourquoi\n- Résultats chiffrés\n- Leçons à retenir\n- Comment le lecteur peut appliquer la même approche`,
      misconceptionsInstr: en
        ? "Explain WHY this misconception is false.\nBack it up with research data if available.\nShow the reality with a concrete example."
        : "Explique POURQUOI cette idée reçue est fausse.\nAppuie-toi sur les données de recherche si disponibles.\nMontre la réalité avec un exemple concret.",
      reflectInstr: en
        ? "Make the reader TRULY think. No multiple choice. An open-ended question that requires understanding the chapter to answer."
        : "Fais VRAIMENT réfléchir le lecteur. Pas de QCM. Une question ouverte qui nécessite d'avoir compris le chapitre pour y répondre.",
      actionInstr: en
        ? (action: string) => `- Key takeaways in 3-4 points (not mechanical listing — rephrase with intelligence)\n- Concrete, immediate action: ${action}`
        : (action: string) => `- Résumé en 3-4 points clés (pas de listing mécanique — reformule avec intelligence)\n- Action concrète et immédiate : ${action}`,

      techniquesHeader: en ? "═══ MANDATORY TECHNIQUES IN THIS CHAPTER ═══" : "═══ TECHNIQUES OBLIGATOIRES DANS CE CHAPITRE ═══",
      techniques: (level: number) => en
        ? `1. At least 2 ANALOGIES from varied domains (do NOT reuse the same domain for both)\n2. At least 2 RHETORICAL QUESTIONS woven into the text\n3. At least 1 PRECISE NUMERICAL EXAMPLE (percentages, amounts, durations, ratios)\n4. At least 1 MYTH BUSTING with evidence\n5. At least 1 REFORMULATION after a complex explanation ("In other words...", "To put it differently...")\n6. ${level >= 1 ? "At least 1 COMPARISON between 2 approaches/frameworks/schools of thought" : "At least 1 COMPARISON (before/after, with/without, for/against)"}\n7. ${level >= 2 ? "At least 1 REFERENCE to recent research, a recognized expert or a well-known study" : ""}\n8. Each ## section must contain at least 60 words of substantive content`
        : `1. Au moins 2 ANALOGIES de domaines variés (ne réutilise PAS le même domaine pour les 2)\n2. Au moins 2 QUESTIONS RHÉTORIQUES intégrées dans le texte\n3. Au moins 1 EXEMPLE CHIFFRÉ précis (pourcentages, montants, durées, ratios)\n4. Au moins 1 MYTHE BUSTING avec preuve\n5. Au moins 1 REFORMULATION après une explication complexe ("En d'autres termes...", "Autrement dit...")\n6. ${level >= 1 ? "Au moins 1 COMPARAISON entre 2 approches/frameworks/écoles de pensée" : "Au moins 1 COMPARAISON (avant/après, avec/sans, pour/contre)"}\n7. ${level >= 2 ? "Au moins 1 RÉFÉRENCE à une recherche récente, un expert reconnu ou une étude connue" : ""}\n8. Chaque ## section doit contenir au moins 60 mots de contenu substantiel`,

      styleHeader: en ? "═══ STYLE ═══" : "═══ STYLE ═══",
      style: en
        ? `- Direct, warm, confident tone — like a mentor who knows what they're talking about\n- Short, punchy sentences (max 3 lines without strong punctuation)\n- Paragraphs of 2-4 sentences MAXIMUM\n- **Bold** for key terms only\n- Bullet lists (-) for enumerations\n- Block quotes (>) for essential insights\n- Alternate: affirmation → question → example → reformulation\n- Rhythmic variety: short, medium, questions`
        : `- Ton direct, chaleureux, confident — comme un mentor qui sait de quoi il parle\n- Phrases courtes et percutantes (max 3 lignes sans ponctuation forte)\n- Paragraphes de 2-4 phrases MAXIMUM\n- **Gras** pour les termes clés uniquement\n- Listes à puces (-) pour énumérations\n- Citations en bloc (>) pour les insights essentiels\n- Alterne : affirmation → question → exemple → reformulation\n- Variété rythmique : courts, moyens, questions`,

      prohibitedHeader: en ? "═══ PROHIBITED ═══" : "═══ INTERDIT ═══",
      prohibited: en
        ? `- Jargon without immediate explanation\n- Empty phrases, filler, generic content\n- Inventing statistics (use research data)\n- Paragraphs longer than 4 sentences\n- Academic tone, textbook style, Wikipedia\n- Repetitive content (every sentence must bring something NEW)\n- Double quotes (") in the JSON — use only single quotes (')\n- Fewer than 500 words per chapter`
        : `- Jargon sans explication immédiate\n- Phrases vides, remplissage, contenu générique\n- Invention de statistiques (utilise les données de recherche)\n- Paragraphes de plus de 4 phrases\n- Ton professoral, manuel scolaire, Wikipédia\n- Contenu répétitif (chaque phrase apporte quelque chose de NOUVEAU)\n- Double quotes (") dans le JSON — utilise seulement des apostrophes (')\n- Moins de 500 mots par chapitre`,

      formatHeader: en ? "═══ RESPONSE FORMAT ═══" : "═══ FORMAT DE RÉPONSE ═══",
      formatInstr: en
        ? "Respond ONLY with this JSON — no text before or after, no markdown fence:"
        : "Réponds UNIQUEMENT avec ce JSON — aucun texte avant ou après, pas de markdown fence :",

      userPrompt: (chapterIdx: number, title: string) => en
        ? `Write chapter ${chapterIdx + 1} on: ${title}`
        : `Rédige le chapitre ${chapterIdx + 1} sur : ${title}`,
    },

    // ── Emergency prompt ──
    emergency: {
      langNote: en ? "Write in English." : "Écris en français.",
      systemPrompt: (langNote: string, levelLabel: string) => en
        ? `You are a teacher. ${langNote} Level: ${levelLabel}. Respond ONLY with valid JSON, no markdown.`
        : `Tu es un professeur. ${langNote} Niveau : ${levelLabel}. Réponds UNIQUEMENT avec du JSON valide, pas de markdown.`,
      userPrompt: (chapterIdx: number, totalChapters: number, courseTitle: string, outline: OutlineChapter) => en
        ? `Write chapter ${chapterIdx + 1} of ${totalChapters} for a course on "${courseTitle}".\nChapter title: "${outline.title}"\nGoal: ${outline.goal}\n\nRespond ONLY with: {"title":"...","content":"## Section 1\\nContent\\n\\n## Section 2\\nContent\\n\\n## Key Takeaways\\nSummary","summary":"One sentence summary"}\n\nThe content must be at least 400 words with proper ## headings.`
        : `Rédige le chapitre ${chapterIdx + 1} sur ${totalChapters} d'un cours sur "${courseTitle}".\nTitre du chapitre : "${outline.title}"\nObjectif : ${outline.goal}\n\nRéponds UNIQUEMENT avec : {"title":"...","content":"## Section 1\\nContenu\\n\\n## Section 2\\nContenu\\n\\n## Points clés\\nRésumé","summary":"Résumé en une phrase"}\n\nLe contenu doit faire au moins 400 mots avec des titres ## appropriés.`,
    },

    // ── Single-call fallback prompt ──
    singleCall: {
      systemRole: en
        ? "You are Coursia AI. You create exceptional courses."
        : "Tu es Coursia AI. Tu crées des cours exceptionnels.",
      langNote: en ? "Write EVERYTHING in English." : "Rédige TOUT en français.",
      rules: en
        ? "RULES: understanding > memorization, examples > definitions, concrete > abstract."
        : "RÈGLES : compréhension > mémorisation, exemples > définitions, concret > abstrait.",
      chapterRules: en
        ? "Each chapter: 500+ words, 4+ subtitles (##), 2+ analogies, 1+ numerical example, 1+ myth busting, 1+ reflection question."
        : "Chaque chapitre : 500+ mots, 4+ sous-titres (##), 2+ analogies, 1+ exemple chiffré, 1+ mythe busting, 1+ question réflexion.",
      structure: en
        ? "Chapter structure: Hook → Context → Concepts (with analogies + examples + common errors) → Myth → Reflection → Action."
        : "Structure par chapitre : Hook → Contexte → Concepts (avec analogies + exemples + erreurs) → Mythe → Réflexion → Action.",
      researchHeader: en ? "RESEARCH DATA:" : "DONNÉES DE RECHERCHE :",
      researchUse: en ? "Use this data for REAL facts." : "Utilise ces données pour des faits RÉELS.",
      jsonFormat: en
        ? `Respond ONLY with this JSON: {"description":"...","chapters":[{"title":"...","content":"## Hook\\n\\n...\\n\\n## Context\\n\\n...\\n\\n## Concepts\\n\\n...\\n\\n> Insight\\n\\n## Myth\\n\\n...\\n\\n## Reflection\\n\\n...\\n\\n## Action\\n\\n...","summary":"..."}]}`
        : `Réponds UNIQUEMENT avec ce JSON : {"description":"...","chapters":[{"title":"...","content":"## Hook\\n\\n...\\n\\n## Contexte\\n\\n...\\n\\n## Concepts\\n\\n...\\n\\n> Insight\\n\\n## Mythe\\n\\n...\\n\\n## Réflexion\\n\\n...\\n\\n## Action\\n\\n...","summary":"..."}]}`,
      userPrompt: en
        ? (level: number, title: string) => `Create a level ${level} course (${MIN_CHAPTERS}-${MAX_CHAPTERS} MANDATORY chapters, no fewer than ${MIN_CHAPTERS}) on: ${title}`
        : (level: number, title: string) => `Crée un cours de niveau ${level} (${MIN_CHAPTERS}-${MAX_CHAPTERS} chapitres OBLIGATOIRES, pas moins de ${MIN_CHAPTERS}) sur : ${title}`,
    },
  };
}

function buildOutlineSystemPrompt(
  title: string, courseLang: string, level: number, webContext: string, sourceContext: string,
): string {
  const s = getPromptStrings(courseLang);

  let researchBlock = "";
  if (webContext || sourceContext) {
    researchBlock = `
${s.outline.researchHeader}
${webContext || s.outline.noData}
${sourceContext || ""}
${s.outline.researchFooter}`;
  }

  return `${s.outline.role}

${s.outline.subjectLabel} : ${title}
${s.outline.languageLabel} : ${s.langLabel}
${s.outline.langNote}

${s.outline.levelDesc[level] || s.outline.levelDesc[1]}

${researchBlock}

${s.outline.missionHeader}
${s.outline.missionText(level)}

${s.outline.chapterCountRule(MIN_CHAPTERS, MAX_CHAPTERS)}

${s.outline.absoluteRules}

${s.outline.jsonOnly}
${s.outline.jsonExample(level)}`;
}

async function generateOutline(
  title: string, courseLang: string, level: number, webContext: string, sourceContext: string,
): Promise<OutlineResult | null> {
  const systemPrompt = buildOutlineSystemPrompt(title, courseLang, level, webContext, sourceContext);
  console.log(`[outline] Generating outline for "${title}" (level=${level}, lang=${courseLang})...`);
  const completion = await smartChatCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: getPromptStrings(courseLang).outline.userPrompt(level, title) },
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
  const s = getPromptStrings(courseLang);
  const isAdvanced = level >= 2;

  let researchBlock = "";
  if (webContext || sourceContext) {
    researchBlock = `
${s.chapter.researchHeader}
${webContext}
${sourceContext}
${s.chapter.researchFooter}
${s.chapter.researchRules}`;
  }

  return `${s.chapter.role}

${s.chapter.contextHeader}
${s.chapter.courseLabel} : ${courseTitle}
${s.chapter.languageLabel} : ${s.langLabel}
${s.chapter.levelLabel} : ${s.chapter.levelValues[level] || s.chapter.levelValues[1]}
${s.chapter.chapterOf(chapterIdx + 1, totalChapters)}
${s.chapter.langNote}
${researchBlock}

${s.chapter.planHeader}
${s.chapter.titleLabel} : ${outline.title}
${s.chapter.goalLabel} : ${outline.goal}
${s.chapter.conceptsLabel} : ${outline.keyConcepts.join(", ")}
${s.chapter.subsectionsLabel} : ${outline.subSections.join(" → ")}
${s.chapter.analogyLabel} : ${outline.plannedAnalogy}
${s.chapter.caseStudyLabel} : ${outline.plannedCaseStudy}
${s.chapter.exampleLabel} : ${outline.plannedExample}
${s.chapter.mythLabel} : ${outline.mythToBust}
${s.chapter.reflectionLabel} : ${outline.reflectionQuestion}
${s.chapter.actionLabel} : ${outline.realAction}
${outline.expertNote ? `${s.chapter.expertNoteLabel} : ${outline.expertNote}` : ""}

${s.chapter.structureHeader}

## ${s.chapter.headings.understanding}
${s.chapter.understandingInstr}

## ${s.chapter.headings.whyCrucial}
${s.chapter.whyCrucialInstr}

## ${s.chapter.headings.fundamentals}
${s.chapter.fundamentalsPrefix} (${outline.keyConcepts.join(", ")}), ${courseLang === "en" ? "follow this strict order" : "respecte cet ordre strict"} :
${s.chapter.fundamentalsOrder(level)}

${s.chapter.blockquoteInstr}

${isAdvanced ? `
${s.chapter.caseStudyInstr(outline.plannedCaseStudy)}
` : ""}

## ${s.chapter.headings.misconceptions}
${outline.mythToBust}
${s.chapter.misconceptionsInstr}

## ${s.chapter.headings.reflect} : ${outline.reflectionQuestion}
${s.chapter.reflectInstr}

## ${s.chapter.headings.action}
${s.chapter.actionInstr(outline.realAction)}

${s.chapter.techniquesHeader}

${s.chapter.techniques(level)}

${s.chapter.styleHeader}

${s.chapter.style}

${s.chapter.prohibitedHeader}

${s.chapter.prohibited}

${s.chapter.formatHeader}

${s.chapter.formatInstr}

{"title":"${outline.title}","content":"## ${s.chapter.headings.understanding}\\n\\n[${courseLang === "en" ? "Hook" : "Accroche"}]\\n\\n## ${s.chapter.headings.whyCrucial}\\n\\n[${courseLang === "en" ? "Context" : "Contexte"}]\\n\\n## ${s.chapter.headings.fundamentals}\\n\\n[${courseLang === "en" ? "Concepts" : "Concepts"}]\\n\\n> [${courseLang === "en" ? "Insight" : "Insight"}]\\n\\n${isAdvanced ? `## ${s.chapter.headings.caseStudy}\\n\\n[${courseLang === "en" ? "Analysis" : "Analyse"}]\\n\\n` : ""}## ${s.chapter.headings.misconceptions}\\n\\n[${courseLang === "en" ? "Myth" : "Mythe"}]\\n\\n## ${s.chapter.headings.reflect}\\n\\n[${courseLang === "en" ? "Question" : "Question"}]\\n\\n## ${s.chapter.headings.action}\\n\\n[${courseLang === "en" ? "Summary + Action" : "Résumé + Action"}]","summary":"${s.chapter.summaryInstruction}"}`;
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
    { role: "user", content: getPromptStrings(courseLang).chapter.userPrompt(chapterIdx, outline.title) },
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
  const s = getPromptStrings(courseLang);
  const levelLabel = level === 0 ? "beginner" : level === 1 ? "intermediate" : "advanced";

  const completion = await smartChatCompletion([
    { role: "system", content: s.emergency.systemPrompt(s.emergency.langNote, levelLabel) },
    { role: "user", content: s.emergency.userPrompt(chapterIdx + 1, totalChapters, courseTitle, outline) },
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
  const s = getPromptStrings(courseLang);
  const researchBlock = (webContext || sourceContext) ? `\n\n${s.singleCall.researchHeader}\n${webContext}\n${sourceContext}\n${s.singleCall.researchUse}` : "";

  const completion = await smartChatCompletion([
    { role: "system", content: [
      `${s.singleCall.systemRole} ${s.chapter.languageLabel} : ${s.langLabel}. ${s.singleCall.langNote}`,
      s.singleCall.rules,
      s.singleCall.chapterRules,
      s.singleCall.structure,
      researchBlock,
      s.singleCall.jsonFormat,
    ].join("\n") },
    { role: "user", content: s.singleCall.userPrompt(level, title) },
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
    let body: { title?: string; sourceLinks?: string[]; level?: number; courseLang?: string; userId?: string; email?: string };
    try {
      body = await request.json();
    } catch {
      console.error("[generate] Invalid JSON body");
      return NextResponse.json({ error: "INVALID_INPUT", message: "Invalid request body" }, { status: 400 });
    }

    const { title, sourceLinks = [], level = 0, courseLang = "en", userId: rawUserId, email: userEmail } = body;
    const userId: string | null = rawUserId || null;
    const isUserAdmin = isAdmin(userEmail);
    if (isUserAdmin) console.log(`[generate] Admin bypass enabled for ${userEmail}`);

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
    // ADMIN BYPASS: Admins skip this check entirely.
    if (userId && !isUserAdmin) {
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
        // FAIL-SAFE: if atomic check fails, use course count as fallback
        try {
          const userCourseCount = await db.course.count({
            where: { userId },
          });
          if (userCourseCount > 0) {
            console.warn(`[generate] Fallback check: user ${userId} has ${userCourseCount} courses, blocking as FREE_LIMIT`);
            return NextResponse.json({ error: "FREE_LIMIT", requiresSubscription: true }, { status: 403 });
          }
          console.warn(`[generate] Fallback check: user ${userId} has 0 courses, allowing (fail-open with course count)`);
        } catch {
          // Even course count failed — truly can't check, allow as last resort
          console.warn(`[generate] Both atomic and fallback checks failed, allowing generation (last-resort fail-open)`);
        }
      }
    }

    // ── DAILY GENERATION LIMIT ──
    // ADMIN BYPASS: Admins skip daily limits entirely.
    if (!isUserAdmin) {
      const DAILY_LIMIT_FREE = 1; // Anonymous users
      const DAILY_LIMIT_SUBSCRIBED = 4; // Active subscribers

      let dailyLimit = userId ? DAILY_LIMIT_SUBSCRIBED : DAILY_LIMIT_FREE;

      // Check subscription status for the daily limit
      if (userId) {
        try {
          const user = await db.user.findUnique({
            where: { id: userId },
            select: { subscriptionStatus: true },
          });
          if (user?.subscriptionStatus !== "active") {
            dailyLimit = DAILY_LIMIT_FREE;
          }
        } catch { /* non-critical, use default */ }
      }

      try {
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);

        const coursesToday = await db.course.count({
          where: {
            userId: userId || null,
            createdAt: { gte: todayStart },
          },
        });

        if (coursesToday >= dailyLimit) {
          const tomorrow = new Date();
          tomorrow.setUTCHours(24, 0, 0, 0);
          const resetInMs = tomorrow.getTime() - Date.now();

          console.log(`[generate] Daily limit reached: ${coursesToday}/${dailyLimit} for user ${userId || 'anonymous'}`);
          return NextResponse.json({
            error: "DAILY_LIMIT",
            message: `Daily generation limit reached (${dailyLimit} courses/day)`,
            dailyLimit,
            coursesToday,
            resetInMs,
            resetAt: tomorrow.toISOString(),
          }, { status: 429 });
        }
      } catch (dailyErr) {
        console.warn("[generate] Daily limit check failed, proceeding:", dailyErr);
      }
    }

    // ── Step 0: Deep web search + source scraping (parallel) ──
    logStep("search_start");
    let zaiInstance: Awaited<ReturnType<typeof getZAI>> | null = null;
    let webContext = "";
    let scrapedPages: ScrapedPage[] = [];

    try {
      zaiInstance = await getZAI();

      // Warm-up call to prime the SDK connection (prevents cold-start failures)
      try {
        console.log("[generate] Warming up SDK connection...");
        await zaiInstance.invokeFunction("web_search", { query: "warmup", num: 1 });
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