const https  = require('https')
const { searchWeb } = require('./search')

// ─── Config ───────────────────────────────────────────────────────────────────
// Endpoint actuel HF (depuis mi-2024) : router.huggingface.co/hf-inference/
// L'ancien api-inference.huggingface.co/models/... retourne 404

const HF_HOSTNAME = 'router.huggingface.co'

const MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.3',
  'HuggingFaceH4/zephyr-7b-beta',
  'microsoft/Phi-3-mini-4k-instruct',
]

const TIMEOUT_MS = 50_000  // < 60 s (limite Vercel)

// ─── HTTPS POST helper ────────────────────────────────────────────────────────

function httpsPost(path, body) {
  return new Promise((resolve, reject) => {
    if (!process.env.HF_TOKEN) {
      return reject(new Error('HF_TOKEN absent des variables d\'environnement'))
    }
    const payload = JSON.stringify(body)
    const options = {
      hostname: HF_HOSTNAME,
      path,
      method : 'POST',
      headers: {
        'Content-Type'  : 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization   : `Bearer ${process.env.HF_TOKEN}`,
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        console.log(`[HF] ${HF_HOSTNAME}${path} → HTTP ${res.statusCode}`)
        resolve({ status: res.statusCode, body: data })
      })
    })
    req.on('error', (err) => {
      console.error('[HF] Erreur réseau :', err.message)
      reject(err)
    })
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`Timeout ${TIMEOUT_MS / 1000}s`)))
    req.write(payload)
    req.end()
  })
}

// ─── Chat Completions (OpenAI-compatible, nouveau router HF) ──────────────────

async function callModel(model, messages, maxTokens = 600) {
  const { status, body } = await httpsPost(
    '/hf-inference/v1/chat/completions',
    { model, messages, max_tokens: maxTokens, temperature: 0.4, top_p: 0.9, stream: false }
  )

  if (status === 503) {
    throw new Error('Modèle en cours de chargement, réessayez dans quelques instants.')
  }
  if (status !== 200) {
    let msg = `HTTP ${status}`
    try { msg = JSON.parse(body).error || msg } catch (_) { /* noop */ }
    console.error(`[HF] ${model} erreur:`, body.substring(0, 300))
    throw new Error(msg)
  }

  const data = JSON.parse(body)
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Format HF inattendu : ' + body.substring(0, 200))
  return text.trim()
}

// ─── Fallback séquentiel sur les modèles ─────────────────────────────────────

async function callWithFallback(messages, maxTokens = 600) {
  let lastError
  for (const model of MODELS) {
    try {
      console.log(`[HF] Essai ${model}…`)
      const result = await callModel(model, messages, maxTokens)
      console.log(`[HF] ✓ ${model}`)
      return result
    } catch (err) {
      console.warn(`[HF] ✗ ${model}: ${err.message.substring(0, 200)}`)
      lastError = err
    }
  }
  throw lastError
}

// ─── Domaines ─────────────────────────────────────────────────────────────────

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
  if (TRUSTED_DOMAINS.some(d => domain.endsWith(d))) return 30
  if (UNRELIABLE_DOMAINS.some(d => domain.endsWith(d))) return 0
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
  return {
    hasAuthor     : /author|auteur|journalist|"author"/i.test(html),
    hasDate       : /datetime=|publishedtime|datemodified|article:published/i.test(html),
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

// ─── checkInformation ─────────────────────────────────────────────────────────

async function checkInformation(query) {
  const sources = await searchWeb(query).catch(() => [])

  const contextBlock = sources.length > 0
    ? sources.map((s, i) => `[${i + 1}] ${s.title} (${s.url})\n${s.snippet}`).join('\n\n')
    : 'Aucune source trouvée en ligne.'

  const messages = [
    {
      role   : 'system',
      content: `Tu es un expert en fact-checking. Analyse l'affirmation fournie en te basant sur les sources disponibles. Réponds TOUJOURS en français.
Commence ta réponse par un verdict clair :
- ✅ VRAI si confirmé par les sources
- ❌ FAUX si contredit par les sources
- ⚠️ INCERTAIN si les sources sont insuffisantes ou contradictoires
Cite les sources avec [1], [2], etc. quand disponibles. Sois factuel et concis (200 mots maximum).`,
    },
    {
      role   : 'user',
      content: `Affirmation à vérifier : "${query}"\n\nSources disponibles :\n${contextBlock}`,
    },
  ]

  const result = await callWithFallback(messages, 500)
  return { result, sources }
}

// ─── scoreArticleCredibility ──────────────────────────────────────────────────

async function scoreArticleCredibility(url) {
  const domain = extractDomain(url)
  let articleText = ''
  let metadata    = { hasAuthor: false, hasDate: false, hasSourceLinks: false }
  let fetchError  = null

  try {
    const urlObj = new URL(url)
    const { status, body } = await new Promise((resolve, reject) => {
      const req = https.request(
        { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } },
        (res) => {
          let data = ''
          res.on('data', c => { data += c })
          res.on('end', () => resolve({ status: res.statusCode, body: data }))
        }
      )
      req.on('error', reject)
      req.setTimeout(10000, () => req.destroy(new Error('Article fetch timeout')))
      req.end()
    })
    if (status !== 200) throw new Error(`HTTP ${status}`)
    articleText = stripHtml(body).substring(0, 2500)
    metadata    = extractArticleMetadata(body)
  } catch (err) {
    fetchError = err.message
  }

  const domainScore    = domainReputationScore(domain)
  const structureScore = (metadata.hasAuthor ? 10 : 0) + (metadata.hasDate ? 5 : 0) + (metadata.hasSourceLinks ? 5 : 0)

  if (fetchError || !articleText) {
    const base = Math.min(100, domainScore + structureScore + 25)
    return {
      score   : base,
      verdict : scoreToVerdict(base),
      analysis: fetchError
        ? `Impossible d'accéder à l'article : ${fetchError}. Score basé sur la réputation du domaine "${domain}".`
        : 'Contenu non disponible.',
      domain, metadata,
    }
  }

  let llmScore = 25, llmVerdict = '', llmAnalysis = ''
  try {
    const messages = [
      {
        role   : 'system',
        content: `Tu es un expert en crédibilité des médias. Analyse l'article fourni et réponds UNIQUEMENT dans ce format exact :
SCORE: [nombre entier entre 0 et 50]
VERDICT: [Excellent / Fiable / Mitigé / Douteux / Trompeur]
ANALYSE: [2 phrases d'explication en français]`,
      },
      {
        role   : 'user',
        content: `URL : ${url}\nDomaine : ${domain} | Auteur : ${metadata.hasAuthor ? 'oui' : 'non'} | Date : ${metadata.hasDate ? 'oui' : 'non'}\n\nExtrait :\n${articleText}`,
      },
    ]
    const response = await callWithFallback(messages, 200)
    const scoreM   = response.match(/SCORE:\s*(\d+)/)
    const verdictM = response.match(/VERDICT:\s*(.+)/m)
    const analyseM = response.match(/ANALYSE:\s*([\s\S]+)/)
    if (scoreM)   llmScore    = Math.min(50, parseInt(scoreM[1], 10))
    if (verdictM) llmVerdict  = verdictM[1].trim()
    if (analyseM) llmAnalysis = analyseM[1].trim()
  } catch (err) {
    console.error('[HF] Analyse URL échouée :', err.message)
    llmAnalysis = 'Analyse IA indisponible. Score calculé sur les critères structurels.'
  }

  const finalScore = Math.min(100, domainScore + structureScore + llmScore)
  return {
    score   : finalScore,
    verdict : llmVerdict  || scoreToVerdict(finalScore),
    analysis: llmAnalysis || `Domaine : ${domainScore}/30 — Structure : ${structureScore}/20.`,
    domain, metadata,
  }
}

module.exports = { checkInformation, scoreArticleCredibility }
