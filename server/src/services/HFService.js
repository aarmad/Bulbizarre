const { InferenceClient } = require('@huggingface/inference')
const { searchWeb } = require('./search')

const client = new InferenceClient(process.env.HF_TOKEN)

// Chaîne de fallback — modèles disponibles via les providers HF actifs (2025)
const CHAT_MODELS = [
  'Qwen/Qwen2.5-72B-Instruct',           // via nebius / together
  'meta-llama/Llama-3.1-8B-Instruct',    // via sambanova / together
  'meta-llama/Llama-3.2-3B-Instruct',    // modèle léger, large disponibilité
]

// ─── Helpers domaine ──────────────────────────────────────────────────────────

const TRUSTED_DOMAINS = [
  'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'afp.com',
  'lemonde.fr', 'lefigaro.fr', 'liberation.fr', 'franceinfo.fr',
  'france24.com', 'leparisien.fr', 'nouvelobs.com',
  'nytimes.com', 'washingtonpost.com', 'theguardian.com',
  'wikipedia.org', 'britannica.com', 'nature.com', 'science.org',
  'who.int', 'sante.gouv.fr', 'gouvernement.fr', 'insee.fr',
]

const UNRELIABLE_DOMAINS = [
  'voila-info.fr', 'meta-infos.fr', 'riposte-laique.fr',
  'fdesouche.com', 'egaliteetreconciliation.fr',
]

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch (_) { return '' }
}

function domainReputationScore(domain) {
  if (TRUSTED_DOMAINS.some((d) => domain.endsWith(d))) return 30
  if (UNRELIABLE_DOMAINS.some((d) => domain.endsWith(d))) return 0
  return 15
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractArticleMetadata(html) {
  const lower = html.toLowerCase()
  return {
    hasAuthor:      /author|auteur|journalist|"author"/i.test(lower),
    hasDate:        /datetime=|publishedtime|datemodified|article:published/i.test(lower),
    hasSourceLinks: (html.match(/href="https?:\/\//g) || []).length > 3,
  }
}

function scoreToVerdict(score) {
  if (score >= 80) return 'Très fiable'
  if (score >= 60) return 'Fiable'
  if (score >= 40) return 'Mitigé'
  if (score >= 20) return 'Peu fiable'
  return 'Non fiable'
}

// ─── Wrapper LLM avec fallback ────────────────────────────────────────────────

/** Timeout d'une promise en ms */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`HF timeout après ${ms}ms`)), ms)
    ),
  ])
}

/**
 * Tente chatCompletion sur chaque modèle de CHAT_MODELS dans l'ordre.
 * Chaque tentative est limitée à 30 secondes.
 * Lève une erreur seulement si tous les modèles échouent.
 */
async function chatWithFallback(messages, options = {}) {
  let lastError

  for (const model of CHAT_MODELS) {
    try {
      console.log(`[HF] Essai avec ${model}...`)
      const completion = await withTimeout(
        client.chatCompletion({
          provider: 'hf-inference',
          model,
          messages,
          max_tokens: options.max_tokens || 700,
          temperature: options.temperature ?? 0.2,
        }),
        30000
      )
      console.log(`[HF] ✓ Succès avec ${model}`)
      return completion.choices[0].message.content
    } catch (err) {
      console.warn(`[HF] ✗ ${model} échoué : ${err.message}`)
      lastError = err
    }
  }

  console.error('[HF] Tous les modèles ont échoué. Dernier erreur :', lastError?.message)
  throw lastError
}

// ─── checkInformation ─────────────────────────────────────────────────────────

async function checkInformation(query) {
  // 1. Recherche web en parallèle (ne bloque jamais)
  const sources = await searchWeb(query).catch(() => [])

  const contextBlock = sources.length > 0
    ? sources.map((s, i) => `[${i + 1}] ${s.title}\n    URL: ${s.url}\n    ${s.snippet}`).join('\n\n')
    : 'Aucun résultat de recherche disponible.'

  const messages = [
    {
      role: 'system',
      content: `Tu es un expert en fact-checking. Tu analyses les informations avec rigueur et objectivité. Tu réponds TOUJOURS en français.

Pour chaque affirmation :
1. Analyse les sources disponibles
2. Donne un verdict clair :
   - ✅ VRAI — si clairement confirmé
   - ❌ FAUX — si clairement contredit
   - ⚠️ INCERTAIN — si insuffisant ou contradictoire
3. Cite les sources par leur numéro [1], [2]...
4. Reste factuel et pédagogique`,
    },
    {
      role: 'user',
      content: `Information à vérifier : "${query}"\n\nSources disponibles :\n${contextBlock}\n\nDonne ton verdict de fact-checking.`,
    },
  ]

  try {
    const result = await chatWithFallback(messages, { max_tokens: 700, temperature: 0.2 })
    return { result, sources }
  } catch (err) {
    // Dégradation gracieuse : on formate les résultats de recherche sans LLM
    console.error('[HF] Tous les modèles ont échoué, dégradation gracieuse :', err.message)

    if (sources.length === 0) {
      return {
        result: '⚠️ INCERTAIN — Aucune source trouvée pour cette affirmation et le service IA est temporairement indisponible. Veuillez reformuler votre question ou réessayer dans quelques instants.',
        sources: [],
      }
    }

    const fallbackResult = [
      '⚠️ INCERTAIN — L\'analyse IA est temporairement indisponible.',
      '',
      'Voici les sources trouvées sur le sujet :',
      ...sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`),
      '',
      'Consultez ces sources pour former votre propre jugement.',
    ].join('\n')

    return { result: fallbackResult, sources }
  }
}

// ─── scoreArticleCredibility ──────────────────────────────────────────────────

async function scoreArticleCredibility(url) {
  const domain = extractDomain(url)
  let articleText = ''
  let metadata = { hasAuthor: false, hasDate: false, hasSourceLinks: false }
  let fetchError = null

  // 1. Récupérer la page
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BulbizarreFactChecker/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('html')) throw new Error("L'URL ne pointe pas vers une page HTML")

    const html = await res.text()
    articleText = stripHtml(html).substring(0, 3000)
    metadata = extractArticleMetadata(html)
  } catch (err) {
    fetchError = err.message
  }

  // 2. Scores heuristiques
  const domainScore    = domainReputationScore(domain)
  const structureScore = (metadata.hasAuthor ? 10 : 0) + (metadata.hasDate ? 5 : 0) + (metadata.hasSourceLinks ? 5 : 0)

  if (fetchError || !articleText) {
    const base = Math.min(100, domainScore + structureScore + 25)
    return {
      score: base,
      verdict: scoreToVerdict(base),
      analysis: fetchError
        ? `Impossible d'accéder à l'article : ${fetchError}. Score basé sur la réputation du domaine "${domain}".`
        : 'Contenu non disponible. Score basé sur la réputation du domaine.',
      domain,
      metadata,
    }
  }

  // 3. Analyse LLM
  let llmScore = 25
  let llmVerdict = ''
  let llmAnalysis = ''

  const messages = [
    {
      role: 'system',
      content: `Tu es un expert en crédibilité des médias. Réponds UNIQUEMENT dans ce format exact :

SCORE: [0-50]
VERDICT: [Excellent / Fiable / Mitigé / Douteux / Trompeur]
ANALYSE: [2-3 phrases en français]`,
    },
    {
      role: 'user',
      content: `Analyse cet article :
URL : ${url}
Domaine : ${domain}
Auteur détecté : ${metadata.hasAuthor ? 'Oui' : 'Non'}
Date détectée : ${metadata.hasDate ? 'Oui' : 'Non'}
Liens sources : ${metadata.hasSourceLinks ? 'Oui' : 'Non'}

Extrait :
${articleText}`,
    },
  ]

  try {
    const response = await chatWithFallback(messages, { max_tokens: 300, temperature: 0.1 })
    const scoreMatch   = response.match(/SCORE:\s*(\d+)/)
    const verdictMatch = response.match(/VERDICT:\s*(.+)/m)
    const analyseMatch = response.match(/ANALYSE:\s*([\s\S]+)/)

    if (scoreMatch)   llmScore   = Math.min(50, parseInt(scoreMatch[1], 10))
    if (verdictMatch) llmVerdict = verdictMatch[1].trim()
    if (analyseMatch) llmAnalysis = analyseMatch[1].trim()
  } catch (err) {
    console.error('[HF] Analyse URL échouée :', err.message)
    llmAnalysis = 'Analyse IA indisponible. Score calculé sur les critères structurels uniquement.'
  }

  const finalScore = Math.min(100, domainScore + structureScore + llmScore)

  return {
    score:    finalScore,
    verdict:  llmVerdict  || scoreToVerdict(finalScore),
    analysis: llmAnalysis || `Réputation du domaine : ${domainScore}/30 — Structure : ${structureScore}/20.`,
    domain,
    metadata,
  }
}

module.exports = { checkInformation, scoreArticleCredibility }
