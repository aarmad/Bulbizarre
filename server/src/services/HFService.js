const { searchWeb } = require('./search')

// ─── Config modèles ───────────────────────────────────────────────────────────
// On appelle l'API HF classique directement (api-inference.huggingface.co)
// car le nouveau SDK v4 chatCompletion nécessite des providers payants.
const MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.3',
  'HuggingFaceH4/zephyr-7b-beta',
  'tiiuae/falcon-7b-instruct',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Appel direct à l'API HF Inference ───────────────────────────────────────

/**
 * Appelle l'API HF Inference classique (api-inference.huggingface.co).
 * Utilise wait_for_model pour attendre si le modèle est en veille (gratuit).
 */
async function callHFModel(model, prompt, maxTokens = 600) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000) // 90s max

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature: 0.4,
          do_sample: true,
          top_p: 0.9,
          return_full_text: false,
        },
        options: {
          wait_for_model: true,  // attend si le modèle est en cold-start
          use_cache: false,
        },
      }),
    })

    clearTimeout(timer)

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`)
    }

    const data = await res.json()

    if (Array.isArray(data) && data[0]?.generated_text) {
      return data[0].generated_text.trim()
    }
    if (data.generated_text) {
      return data.generated_text.trim()
    }
    if (data.error) {
      throw new Error(data.error)
    }

    throw new Error('Format de réponse HF inattendu : ' + JSON.stringify(data).substring(0, 100))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Essaie chaque modèle dans l'ordre, retourne dès qu'un réussit.
 */
async function callWithFallback(prompt, maxTokens = 600) {
  let lastError
  for (const model of MODELS) {
    try {
      console.log(`[HF] Essai ${model}...`)
      const result = await callHFModel(model, prompt, maxTokens)
      console.log(`[HF] ✓ Succès avec ${model}`)
      return result
    } catch (err) {
      console.warn(`[HF] ✗ ${model}: ${err.message.substring(0, 120)}`)
      lastError = err
    }
  }
  throw lastError
}

/**
 * Formate un prompt d'instruction simple, compatible avec Mistral/Zephyr/Falcon.
 */
function buildPrompt(instruction, context) {
  return `### Instruction:\n${instruction}\n\n### Contexte:\n${context}\n\n### Réponse:\n`
}

// ─── checkInformation ─────────────────────────────────────────────────────────

async function checkInformation(query) {
  const sources = await searchWeb(query).catch(() => [])

  const contextBlock = sources.length > 0
    ? sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join('\n\n')
    : 'Aucune source trouvée.'

  const instruction = `Tu es un expert en fact-checking. Analyse l'affirmation suivante en te basant sur les sources fournies. Réponds en français.
Donne un verdict clair :
- ✅ VRAI si confirmé par les sources
- ❌ FAUX si contredit par les sources
- ⚠️ INCERTAIN si les sources sont insuffisantes
Cite les sources avec [1], [2], etc. Sois factuel et concis (200 mots max).`

  const context = `Affirmation à vérifier : "${query}"\n\nSources disponibles :\n${contextBlock}`

  const prompt = buildPrompt(instruction, context)

  try {
    const result = await callWithFallback(prompt, 500)
    return { result, sources }
  } catch (err) {
    console.error('[HF] Tous les modèles ont échoué :', err.message)

    // Dégradation gracieuse — retourne les sources sans analyse IA
    if (sources.length === 0) {
      return {
        result: '⚠️ INCERTAIN — Service IA temporairement indisponible et aucune source trouvée. Réessayez dans quelques instants.',
        sources: [],
      }
    }

    const fallback = [
      '⚠️ INCERTAIN — Analyse IA indisponible (le modèle est peut-être en cours de chargement).',
      '',
      'Sources trouvées sur le sujet :',
      ...sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet.substring(0, 200)}...`),
    ].join('\n')

    return { result: fallback, sources }
  }
}

// ─── scoreArticleCredibility ──────────────────────────────────────────────────

async function scoreArticleCredibility(url) {
  const domain = extractDomain(url)
  let articleText = ''
  let metadata = { hasAuthor: false, hasDate: false, hasSourceLinks: false }
  let fetchError = null

  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BulbizarreFactChecker/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(t)

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('html')) throw new Error("Pas une page HTML")

    const html = await res.text()
    articleText = stripHtml(html).substring(0, 2500)
    metadata = extractArticleMetadata(html)
  } catch (err) {
    fetchError = err.message
  }

  const domainScore    = domainReputationScore(domain)
  const structureScore = (metadata.hasAuthor ? 10 : 0) + (metadata.hasDate ? 5 : 0) + (metadata.hasSourceLinks ? 5 : 0)

  if (fetchError || !articleText) {
    const base = Math.min(100, domainScore + structureScore + 25)
    return {
      score: base,
      verdict: scoreToVerdict(base),
      analysis: fetchError
        ? `Impossible d'accéder à l'article : ${fetchError}. Score basé sur la réputation du domaine "${domain}".`
        : 'Contenu non disponible.',
      domain,
      metadata,
    }
  }

  let llmScore = 25
  let llmVerdict = ''
  let llmAnalysis = ''

  try {
    const instruction = `Tu es un expert en crédibilité des médias. Analyse cet article et réponds UNIQUEMENT dans ce format exact :
SCORE: [nombre entre 0 et 50]
VERDICT: [Excellent / Fiable / Mitigé / Douteux / Trompeur]
ANALYSE: [2 phrases d'explication en français]`

    const context = `URL : ${url}
Domaine : ${domain} | Auteur : ${metadata.hasAuthor ? 'oui' : 'non'} | Date : ${metadata.hasDate ? 'oui' : 'non'}

Extrait :
${articleText}`

    const response = await callWithFallback(buildPrompt(instruction, context), 200)

    const scoreM   = response.match(/SCORE:\s*(\d+)/)
    const verdictM = response.match(/VERDICT:\s*(.+)/m)
    const analyseM = response.match(/ANALYSE:\s*([\s\S]+)/)

    if (scoreM)   llmScore   = Math.min(50, parseInt(scoreM[1], 10))
    if (verdictM) llmVerdict = verdictM[1].trim()
    if (analyseM) llmAnalysis = analyseM[1].trim()
  } catch (err) {
    console.error('[HF] Analyse URL échouée :', err.message)
    llmAnalysis = 'Analyse IA indisponible. Score calculé sur les critères structurels.'
  }

  const finalScore = Math.min(100, domainScore + structureScore + llmScore)
  return {
    score:    finalScore,
    verdict:  llmVerdict  || scoreToVerdict(finalScore),
    analysis: llmAnalysis || `Domaine : ${domainScore}/30 — Structure : ${structureScore}/20.`,
    domain,
    metadata,
  }
}

module.exports = { checkInformation, scoreArticleCredibility }
