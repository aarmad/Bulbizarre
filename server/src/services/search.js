/**
 * Service de recherche web
 * Primaire  : Google via Serper.dev (vrais résultats Google, actualité incluse)
 * Fallback  : Wikipedia FR + EN (si Serper indisponible ou quota épuisé)
 */
const https = require('https')

const TIMEOUT_MS = 10_000

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path    : urlObj.pathname + urlObj.search,
        method  : 'GET',
        headers : { 'User-Agent': 'BulbizarreSearch/1.0', Accept: 'application/json' },
      },
      (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return httpsGet(res.headers.location).then(resolve).catch(reject)
        }
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) } catch (_) { resolve(data) }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Timeout')))
    req.end()
  })
}

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request(
      {
        hostname,
        path,
        method : 'POST',
        headers: {
          'Content-Type'  : 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }) }
          catch (_) { resolve({ status: res.statusCode, data }) }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('Timeout')))
    req.write(payload)
    req.end()
  })
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

// ─── Serper.dev (Google Search) ───────────────────────────────────────────────

async function searchSerper(query) {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.warn('[Search] SERPER_API_KEY absent — fallback Wikipedia')
    return []
  }

  const { status, data } = await httpsPost(
    'google.serper.dev',
    '/search',
    { q: query, num: 8, hl: 'fr', gl: 'fr' },
    { 'X-API-KEY': apiKey }
  )

  if (status !== 200 || typeof data !== 'object') {
    console.warn('[Search] Serper HTTP', status)
    return []
  }

  const sources = []

  // Boîte de réponse directe (ex: "Qui est X ?")
  if (data.answerBox?.answer || data.answerBox?.snippet) {
    sources.push({
      title  : data.answerBox.title || query,
      url    : data.answerBox.link  || `https://google.com/search?q=${encodeURIComponent(query)}`,
      snippet: (data.answerBox.answer || data.answerBox.snippet).substring(0, 500),
      date   : null,
    })
  }

  // Résultats organiques Google
  for (const r of (data.organic || []).slice(0, 6)) {
    if (!r.link || !r.snippet) continue
    sources.push({
      title  : r.title   || r.link,
      url    : r.link,
      snippet: (r.snippet + (r.date ? ` (${r.date})` : '')).substring(0, 500),
      date   : r.date || null,
    })
  }

  // Knowledge Graph (fiche entité Google)
  if (data.knowledgeGraph?.description) {
    sources.push({
      title  : data.knowledgeGraph.title || query,
      url    : data.knowledgeGraph.descriptionLink || data.knowledgeGraph.website || '',
      snippet: data.knowledgeGraph.description.substring(0, 500),
      date   : null,
    })
  }

  console.log(`[Search] Serper → ${sources.length} résultats Google`)
  return sources
}

// ─── Wikipedia (fallback) ─────────────────────────────────────────────────────

async function searchWikipediaLang(query, lang = 'fr') {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`
  const searchData = await httpsGet(searchUrl)
  const pages = searchData?.query?.search || []

  const sources = []
  for (const page of pages.slice(0, 2)) {
    try {
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
      const summary = await httpsGet(summaryUrl)
      if (!summary.extract || summary.extract.length < 80) continue
      sources.push({
        title  : summary.title,
        url    : summary.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        snippet: summary.extract.substring(0, 500),
        date   : null,
      })
    } catch (_) { /* continuer */ }
  }
  return sources
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

async function searchWeb(query) {
  const hasSerper = !!process.env.SERPER_API_KEY

  let sources = []

  if (hasSerper) {
    // Google en premier (résultats récents et pertinents)
    const [serperResult, wikifrResult, wikienResult] = await Promise.allSettled([
      withTimeout(searchSerper(query),          TIMEOUT_MS),
      withTimeout(searchWikipediaLang(query, 'fr'), TIMEOUT_MS),
      withTimeout(searchWikipediaLang(query, 'en'), TIMEOUT_MS),
    ])
    if (serperResult.status  === 'fulfilled') sources.push(...serperResult.value)
    if (wikifrResult.status  === 'fulfilled') sources.push(...wikifrResult.value)
    if (wikienResult.status  === 'fulfilled') sources.push(...wikienResult.value)
  } else {
    // Sans Serper : Wikipedia uniquement
    const [wikifrResult, wikienResult] = await Promise.allSettled([
      withTimeout(searchWikipediaLang(query, 'fr'), TIMEOUT_MS),
      withTimeout(searchWikipediaLang(query, 'en'), TIMEOUT_MS),
    ])
    if (wikifrResult.status === 'fulfilled') sources.push(...wikifrResult.value)
    if (wikienResult.status === 'fulfilled') sources.push(...wikienResult.value)
  }

  // Déduplication par URL, filtre snippets trop courts
  const seen = new Set()
  const filtered = sources.filter(s => {
    if (!s.snippet || s.snippet.length < 40) return false
    const key = s.url || s.title
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`[Search] ${filtered.length} sources finales (Serper: ${hasSerper})`)
  return filtered.slice(0, 7)
}

module.exports = { searchWeb }
