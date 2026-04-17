const https = require("https");
const { searchWeb } = require("./search");

// ─── Config Groq ──────────────────────────────────────────────────────────────

const MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768",
];

const TIMEOUT_MS = 30_000;

// ─── HTTPS POST helper ────────────────────────────────────────────────────────

function httpsPost(body) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
      return reject(
        new Error("GROQ_API_KEY absent des variables d'environnement"),
      );

    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.groq.com",
        path: "/openai/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Authorization: `Bearer ${apiKey}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          console.log(`[AI] Groq → HTTP ${res.statusCode}`);
          resolve({ status: res.statusCode, body: data });
        });
      },
    );
    req.on("error", (err) => {
      console.error("[AI] Erreur réseau :", err.message);
      reject(err);
    });
    req.setTimeout(TIMEOUT_MS, () =>
      req.destroy(new Error(`Timeout ${TIMEOUT_MS / 1000}s`)),
    );
    req.write(payload);
    req.end();
  });
}

// ─── Appel modèle ─────────────────────────────────────────────────────────────

async function callModel(model, messages, maxTokens = 700) {
  const { status, body } = await httpsPost({
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.3,
    top_p: 0.9,
    stream: false,
  });

  if (status !== 200) {
    let msg = `HTTP ${status}`;
    try {
      const parsed = JSON.parse(body);
      msg = parsed.error?.message || parsed.error || msg;
    } catch (_) {
      /* noop */
    }
    console.error(`[AI] ${model} erreur:`, body.substring(0, 300));
    throw new Error(msg);
  }

  const data = JSON.parse(body);
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Format inattendu : " + body.substring(0, 200));
  return text.trim();
}

// ─── Fallback séquentiel ──────────────────────────────────────────────────────

async function callWithFallback(messages, maxTokens = 700) {
  let lastError;
  for (const model of MODELS) {
    try {
      console.log(`[AI] Essai ${model}…`);
      const result = await callModel(model, messages, maxTokens);
      console.log(`[AI] ✓ ${model}`);
      return result;
    } catch (err) {
      console.warn(`[AI] ✗ ${model}: ${err.message.substring(0, 200)}`);
      lastError = err;
    }
  }
  throw lastError;
}

// ─── Domaines ─────────────────────────────────────────────────────────────────

const TRUSTED_DOMAINS = [
  // Agences de presse internationales
  "reuters.com", "apnews.com", "afp.com", "bloomberg.com", "dpa-international.com",
  // Presse française généraliste
  "lemonde.fr", "lefigaro.fr", "liberation.fr", "leparisien.fr", "nouvelobs.com",
  "lexpress.fr", "lepoint.fr", "lopinion.fr", "la-croix.com", "humanite.fr",
  "telerama.fr", "mediapart.fr", "lecanardenchaine.fr",
  // Presse française régionale sérieuse
  "sudouest.fr", "ouest-france.fr", "lavoixdunord.fr", "ledauphine.com",
  "leprogres.fr", "ladepeche.fr",
  // Audiovisuel public français
  "franceinfo.fr", "france24.com", "rfi.fr", "france.tv", "francetv.fr",
  "radio-canada.ca", "rtbf.be",
  // Presse internationale anglophone
  "bbc.com", "bbc.co.uk", "nytimes.com", "washingtonpost.com", "theguardian.com",
  "economist.com", "ft.com", "wsj.com", "npr.org", "pbs.org", "time.com",
  "newsweek.com", "theatlantic.com", "politico.com", "axios.com",
  "independent.co.uk", "telegraph.co.uk", "thetimes.co.uk",
  // Presse européenne
  "spiegel.de", "dw.com", "lematin.ch", "rts.ch", "24heures.ch",
  "lesoir.be", "lalibre.be", "dhnet.be", "corriere.it", "elpais.com",
  // Fact-checkers reconnus
  "snopes.com", "factcheck.org", "politifact.com", "fullfact.org",
  "lesdecodeurs.fr", "checknews.fr", "decodeurs.lemonde.fr",
  "factuel.afp.com", "stopfake.org", "adfontesmedia.com",
  // Sources scientifiques et académiques
  "nature.com", "science.org", "scientificamerican.com", "newscientist.com",
  "thelancet.com", "nejm.org", "bmj.com", "pubmed.ncbi.nlm.nih.gov",
  "scholar.google.com", "arxiv.org", "hal.science",
  // Encyclopédies et références
  "wikipedia.org", "britannica.com", "larousse.fr", "universalis.fr",
  // Organismes officiels français
  "gouvernement.fr", "elysee.fr", "senat.fr", "assemblee-nationale.fr",
  "sante.gouv.fr", "education.gouv.fr", "justice.gouv.fr", "interieur.gouv.fr",
  "insee.fr", "service-public.fr", "legifrance.gouv.fr", "vie-publique.fr",
  "data.gouv.fr", "has-sante.fr", "anses.fr", "inserm.fr", "cnrs.fr",
  // Organismes internationaux
  "who.int", "un.org", "europa.eu", "oecd.org", "worldbank.org",
  "unicef.org", "unhcr.org", "amnesty.org", "hrw.org",
  // Météo et sciences
  "meteofrance.com", "nasa.gov", "esa.int", "cnes.fr",
];

const UNRELIABLE_DOMAINS = [
  // Complotisme et désinformation française
  "voila-info.fr", "meta-infos.fr", "riposte-laique.fr", "fdesouche.com",
  "egaliteetreconciliation.fr", "les-crises.fr", "vududroit.com",
  "bvoltaire.fr", "medias-presse.info", "reinformation.tv",
  "francesoir.fr", "tvlibertes.com", "resistancerepublicaine.fr",
  "polemia.com", "ojim.fr", "bd-multimedia.fr",
  // Sites de fake news internationaux connus
  "infowars.com", "naturalnews.com", "beforeitsnews.com", "zerohedge.com",
  "breitbart.com", "thegatewaypundit.com", "rt.com", "sputniknews.com",
  "tass.com", "globalresearch.ca", "activistpost.com", "yournewswire.com",
  "newspunch.com", "worldnewsdailyreport.com", "empirenews.net",
  // Pseudo-sciences et santé alternative
  "doctissimo.fr", "alternatif-bien-etre.fr", "nexus-newstimes.com",
];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function domainReputationScore(domain) {
  if (TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return 30;
  if (UNRELIABLE_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) return 0;
  // .gouv.fr, .edu, .ac.fr, .org institutionnels
  if (/\.gouv\.fr$/.test(domain) || /\.edu$/.test(domain) || /\.ac\.fr$/.test(domain)) return 28;
  if (/\.gov$/.test(domain) || /\.gc\.ca$/.test(domain)) return 28;
  return 12;
}

function extractMainContent(html) {
  // Prioritize semantic containers
  const containers = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /class="[^"]*(?:article-body|article__body|post-content|entry-content|story-body|content-body)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
    /id="[^"]*(?:article-body|main-content|content|story)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
  ];
  for (const re of containers) {
    const m = html.match(re);
    if (m && m[1] && m[1].length > 500) {
      return m[1];
    }
  }
  return html;
}

function stripHtml(html) {
  const main = extractMainContent(html);
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const SENSATIONALIST_KEYWORDS = [
  "CHOC", "SCANDALE", "INCROYABLE", "RÉVÉLATION", "SECRET", "COMPLOT",
  "ILS NE VEULENT PAS", "CE QU'ILS CACHENT", "LA VÉRITÉ SUR", "URGENT",
  "BREAKING", "EXCLUSIVE", "SHOCKING", "BOMBSHELL", "EXPOSED",
  "ils vous mentent", "grande manipulation", "médias mainstream",
];

function extractArticleMetadata(html, url = "") {
  const text = stripHtml(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const upperWords = (text.match(/\b[A-ZÀÉÈÊËÎÏÔÙÛÜ]{4,}\b/g) || []).length;
  const totalWords = Math.max(1, wordCount);
  const capsRatio = upperWords / totalWords;

  const sensationalistCount = SENSATIONALIST_KEYWORDS.filter((kw) =>
    html.toLowerCase().includes(kw.toLowerCase())
  ).length;

  return {
    hasAuthor: /(?:author|auteur|journalist|byline|"author"|name="author"|rel="author")/i.test(html),
    hasDate: /(?:datetime=|publishedtime|datemodified|article:published|datePublished|pubdate)/i.test(html),
    hasSourceLinks: (html.match(/href="https?:\/\//g) || []).length > 5,
    isHttps: url.startsWith("https://"),
    wordCount,
    hasSufficientContent: wordCount > 300,
    capsRatio: Math.round(capsRatio * 100) / 100,
    sensationalistCount,
    hasStructuredData: /application\/ld\+json|schema\.org/i.test(html),
    hasContactPage: /contact|impressum|mentions.l.gales|about.us/i.test(html),
  };
}
function scoreToVerdict(score) {
  if (score >= 80) return "Très fiable";
  if (score >= 60) return "Fiable";
  if (score >= 40) return "Mitigé";
  if (score >= 20) return "Peu fiable";
  return "Non fiable";
}

// ─── checkInformation ─────────────────────────────────────────────────────────

async function checkInformation(query) {
  const sources = await searchWeb(query).catch((err) => {
    console.warn("[Search] Échec :", err.message);
    return [];
  });

  const hasSources = sources.length > 0;
  const contextBlock = hasSources
    ? sources
        .map(
          (s, i) =>
            `[${i + 1}] ${s.title}\nURL: ${s.url}\nExtrait: ${s.snippet}`,
        )
        .join("\n\n---\n\n")
    : null;

  const verdictChoices = `VRAI | PLUTÔT VRAI | TROMPEUR | INCERTAIN | PLUTÔT FAUX | FAUX`;

  const systemPrompt = hasSources
    ? `Tu es un expert en fact-checking rigoureux. Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après.

Format de réponse OBLIGATOIRE :
{"verdict":"<choix>","explanation":"<texte en français>"}

Valeurs autorisées pour "verdict" (choisis la plus précise) :
- "VRAI" : affirmation confirmée par des sources fiables
- "PLUTÔT VRAI" : globalement exact mais avec nuances importantes
- "TROMPEUR" : techniquement exact mais présenté pour induire en erreur
- "INCERTAIN" : sources insuffisantes pour trancher
- "PLUTÔT FAUX" : probablement faux mais sans certitude absolue
- "FAUX" : clairement contredit par des sources fiables

Règles strictes :
- Évalue l'affirmation EXACTE, pas un fait adjacent ou connexe
- "X a dit que Y est Z" ≠ "Y est Z" → si la question porte sur Y, réponds sur Y
- Une accusation n'est pas un fait établi
- Si les sources parlent autour du sujet sans confirmer/infirmer directement → "INCERTAIN"
- L'explication doit être en français, 3-5 phrases, citer les sources [1] [2] etc.`
    : `Tu es un expert en fact-checking rigoureux. Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après.

Format de réponse OBLIGATOIRE :
{"verdict":"<choix>","explanation":"<texte en français>"}

Valeurs autorisées : ${verdictChoices}

Règles strictes :
- Évalue l'affirmation EXACTE, pas un fait adjacent
- Précise que l'analyse est basée sur tes connaissances sans sources en temps réel
- L'explication en français, 3-5 phrases`;

  const userMessage = hasSources
    ? `Affirmation à vérifier : "${query}"\n\nSources trouvées :\n\n${contextBlock}`
    : `Affirmation à vérifier : "${query}"`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const raw = await callWithFallback(messages, 700);

  // Parse JSON response
  let verdict = "INCERTAIN";
  let explanation = raw;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const VALID_VERDICTS = ["VRAI", "PLUTÔT VRAI", "TROMPEUR", "INCERTAIN", "PLUTÔT FAUX", "FAUX"];
      if (parsed.verdict && VALID_VERDICTS.includes(parsed.verdict.trim().toUpperCase())) {
        verdict = parsed.verdict.trim().toUpperCase();
      }
      if (parsed.explanation) explanation = parsed.explanation.trim();
    }
  } catch (_) {
    // fallback: try to detect verdict in raw text
    const verdictMap = [
      ["PLUTÔT VRAI", "PLUTÔT VRAI"], ["PLUTÔT FAUX", "PLUTÔT FAUX"],
      ["TROMPEUR", "TROMPEUR"], ["INCERTAIN", "INCERTAIN"],
      ["VRAI", "VRAI"], ["FAUX", "FAUX"],
    ];
    for (const [kw, v] of verdictMap) {
      if (raw.toUpperCase().includes(kw)) { verdict = v; break; }
    }
  }

  return { verdict, explanation, sources };
}

// ─── scoreArticleCredibility ──────────────────────────────────────────────────

async function scoreArticleCredibility(url) {
  const domain = extractDomain(url);
  let articleText = "";
  let metadata = { hasAuthor: false, hasDate: false, hasSourceLinks: false };
  let fetchError = null;

  try {
    const urlObj = new URL(url);
    const { status, body } = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => {
            data += c;
          });
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        },
      );
      req.on("error", reject);
      req.setTimeout(10000, () =>
        req.destroy(new Error("Article fetch timeout")),
      );
      req.end();
    });
    if (status !== 200) throw new Error(`HTTP ${status}`);
    articleText = stripHtml(body).substring(0, 3000);
    metadata = extractArticleMetadata(body, url);
  } catch (err) {
    fetchError = err.message;
  }

  const domainScore = domainReputationScore(domain);

  // Structure score: max 20 pts
  const structureScore = Math.min(20,
    (metadata.hasAuthor ? 5 : 0) +
    (metadata.hasDate ? 4 : 0) +
    (metadata.hasSourceLinks ? 3 : 0) +
    (metadata.isHttps ? 3 : 0) +
    (metadata.hasSufficientContent ? 3 : 0) +
    (metadata.hasStructuredData ? 1 : 0) +
    (metadata.hasContactPage ? 1 : 0)
  );

  // Penalty for sensationalist content and excessive caps
  const penalty = Math.min(15,
    metadata.sensationalistCount * 3 +
    (metadata.capsRatio > 0.15 ? 5 : 0)
  );

  if (fetchError || !articleText) {
    const base = Math.max(0, Math.min(100, domainScore + structureScore + 20 - penalty));
    return {
      score: base,
      verdict: scoreToVerdict(base),
      analysis: fetchError
        ? `Impossible d'accéder à l'article : ${fetchError}. Score basé sur la réputation du domaine "${domain}".`
        : "Contenu non disponible.",
      domain,
      metadata,
    };
  }

  let llmScore = 20, llmVerdict = "", llmAnalysis = "";
  try {
    const messages = [
      {
        role: "system",
        content: `Tu es un expert en crédibilité journalistique et fact-checking. Analyse cet article et réponds UNIQUEMENT dans ce format exact :
SCORE: [nombre entier entre 0 et 40]
VERDICT: [Très fiable / Fiable / Mitigé / Peu fiable / Non fiable]
ANALYSE: [2-3 phrases d'explication précises en français]

Critères d'évaluation (chacun influe sur le score) :
- Neutralité du ton : absence de langage émotionnel excessif ou d'appels à la peur
- Qualité des sources citées : références vérifiables, experts nommés, données chiffrées sourcées
- Structure journalistique : présentation équilibrée, réponse aux questions Qui/Quoi/Quand/Où/Pourquoi
- Absence de théories du complot ou d'affirmations invérifiables
- Cohérence interne et logique des arguments`,
      },
      {
        role: "user",
        content: `URL : ${url}
Domaine : ${domain}
Auteur identifié : ${metadata.hasAuthor ? "oui" : "non"}
Date de publication : ${metadata.hasDate ? "oui" : "non"}
Connexion sécurisée (HTTPS) : ${metadata.isHttps ? "oui" : "non"}
Nombre de mots estimé : ${metadata.wordCount}
Liens sources externes : ${metadata.hasSourceLinks ? "oui" : "non"}
Mots en majuscules (ratio) : ${Math.round(metadata.capsRatio * 100)}%
Termes sensationnalistes détectés : ${metadata.sensationalistCount}

Extrait de l'article :
${articleText}`,
      },
    ];
    const response = await callWithFallback(messages, 300);
    const scoreM = response.match(/SCORE:\s*(\d+)/);
    const verdictM = response.match(/VERDICT:\s*(.+)/m);
    const analyseM = response.match(/ANALYSE:\s*([\s\S]+)/);
    if (scoreM) llmScore = Math.min(40, parseInt(scoreM[1], 10));
    if (verdictM) llmVerdict = verdictM[1].trim();
    if (analyseM) llmAnalysis = analyseM[1].trim();
  } catch (err) {
    console.error("[AI] Analyse URL échouée :", err.message);
    llmAnalysis = "Analyse IA indisponible. Score calculé sur les critères structurels.";
  }

  const finalScore = Math.max(0, Math.min(100, domainScore + structureScore + llmScore - penalty));
  return {
    score: finalScore,
    verdict: llmVerdict || scoreToVerdict(finalScore),
    analysis: llmAnalysis || `Domaine : ${domainScore}/30 — Structure : ${structureScore}/20.`,
    domain,
    metadata,
  };
}

// ─── verifyHeadline ───────────────────────────────────────────────────────────

async function verifyHeadline(headline) {
  const systemPrompt = `Tu es un expert en détection de fausses nouvelles (fact-checking). 
Analyse le titre d'article fourni et réponds UNIQUEMENT dans ce format exact en JSON :
{
  "verdict": "VRAI|FAUX|INDÉTERMINÉ",
  "score": <nombre entier entre 0 et 100>,
  "explanation": "<explication courte en français (2-3 phrases)>"
}

Évalue la plausibilité et la probabilité que ce titre soit vrai ou faux basé sur tes connaissances.
- VRAI : titre vraisemblable et cohérent avec la réalité
- FAUX : titre clairement faux ou très improbable
- INDÉTERMINÉ : titre nécessitant vérification externe`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Vérifiez ce titre : "${headline}"` },
  ];

  try {
    const result = await callWithFallback(messages, 300);

    // Essayer de parser la réponse JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        verdict: parsed.verdict || "INDÉTERMINÉ",
        score: Math.min(100, Math.max(0, parsed.score || 50)),
        explanation: parsed.explanation || result,
      };
    }

    // Fallback : vérification basique du contenu
    const isFake =
      result.toLowerCase().includes("faux") ||
      result.toLowerCase().includes("fake") ||
      result.toLowerCase().includes("pas vrai");

    return {
      verdict: isFake ? "FAUX" : "VRAI",
      score: isFake ? 30 : 75,
      explanation: result,
    };
  } catch (error) {
    console.error("[AI] Erreur verifyHeadline :", error.message);
    return {
      verdict: "INDÉTERMINÉ",
      score: 50,
      explanation: `Erreur lors de la vérification : ${error.message}`,
    };
  }
}

module.exports = { checkInformation, scoreArticleCredibility, verifyHeadline };
