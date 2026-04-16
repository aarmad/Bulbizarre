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
  "bbc.com",
  "bbc.co.uk",
  "reuters.com",
  "apnews.com",
  "afp.com",
  "lemonde.fr",
  "lefigaro.fr",
  "liberation.fr",
  "franceinfo.fr",
  "france24.com",
  "leparisien.fr",
  "nouvelobs.com",
  "nytimes.com",
  "washingtonpost.com",
  "theguardian.com",
  "wikipedia.org",
  "britannica.com",
  "nature.com",
  "science.org",
  "who.int",
  "sante.gouv.fr",
  "gouvernement.fr",
  "insee.fr",
];
const UNRELIABLE_DOMAINS = [
  "voila-info.fr",
  "meta-infos.fr",
  "riposte-laique.fr",
  "fdesouche.com",
  "egaliteetreconciliation.fr",
];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}
function domainReputationScore(domain) {
  if (TRUSTED_DOMAINS.some((d) => domain.endsWith(d))) return 30;
  if (UNRELIABLE_DOMAINS.some((d) => domain.endsWith(d))) return 0;
  return 15;
}
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function extractArticleMetadata(html) {
  return {
    hasAuthor: /author|auteur|journalist|"author"/i.test(html),
    hasDate: /datetime=|publishedtime|datemodified|article:published/i.test(
      html,
    ),
    hasSourceLinks: (html.match(/href="https?:\/\//g) || []).length > 3,
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

  const systemPrompt = hasSources
    ? `Tu es un expert en fact-checking. Analyse l'affirmation en te basant UNIQUEMENT sur les sources fournies.

Réponds en français avec cette structure :
1. Première ligne obligatoirement : [VRAI], [FAUX], ou [INCERTAIN]
2. Explication (3-5 phrases) basée sur les sources
3. Cite les sources utilisées : [1], [2], etc.
4. Si les sources ne couvrent pas directement le sujet, dis-le.

Sois factuel, précis, concis (200 mots max).`
    : `Tu es un expert en fact-checking. Aucune source web n'a été trouvée.
Réponds en français. Commence obligatoirement par [INCERTAIN] puis donne ton analyse basée sur tes connaissances en précisant ce caractère.`;

  const userMessage = hasSources
    ? `Affirmation à vérifier : "${query}"\n\nSources trouvées :\n\n${contextBlock}`
    : `Affirmation à vérifier : "${query}"`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const result = await callWithFallback(messages, 600);
  return { result, sources };
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
    articleText = stripHtml(body).substring(0, 2500);
    metadata = extractArticleMetadata(body);
  } catch (err) {
    fetchError = err.message;
  }

  const domainScore = domainReputationScore(domain);
  const structureScore =
    (metadata.hasAuthor ? 10 : 0) +
    (metadata.hasDate ? 5 : 0) +
    (metadata.hasSourceLinks ? 5 : 0);

  if (fetchError || !articleText) {
    const base = Math.min(100, domainScore + structureScore + 25);
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

  let llmScore = 25,
    llmVerdict = "",
    llmAnalysis = "";
  try {
    const messages = [
      {
        role: "system",
        content: `Tu es un expert en crédibilité des médias. Analyse l'article fourni et réponds UNIQUEMENT dans ce format exact :
SCORE: [nombre entier entre 0 et 50]
VERDICT: [Excellent / Fiable / Mitigé / Douteux / Trompeur]
ANALYSE: [2 phrases d'explication en français]`,
      },
      {
        role: "user",
        content: `URL : ${url}\nDomaine : ${domain} | Auteur : ${metadata.hasAuthor ? "oui" : "non"} | Date : ${metadata.hasDate ? "oui" : "non"}\n\nExtrait :\n${articleText}`,
      },
    ];
    const response = await callWithFallback(messages, 250);
    const scoreM = response.match(/SCORE:\s*(\d+)/);
    const verdictM = response.match(/VERDICT:\s*(.+)/m);
    const analyseM = response.match(/ANALYSE:\s*([\s\S]+)/);
    if (scoreM) llmScore = Math.min(50, parseInt(scoreM[1], 10));
    if (verdictM) llmVerdict = verdictM[1].trim();
    if (analyseM) llmAnalysis = analyseM[1].trim();
  } catch (err) {
    console.error("[AI] Analyse URL échouée :", err.message);
    llmAnalysis =
      "Analyse IA indisponible. Score calculé sur les critères structurels.";
  }

  const finalScore = Math.min(100, domainScore + structureScore + llmScore);
  return {
    score: finalScore,
    verdict: llmVerdict || scoreToVerdict(finalScore),
    analysis:
      llmAnalysis ||
      `Domaine : ${domainScore}/30 — Structure : ${structureScore}/20.`,
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
