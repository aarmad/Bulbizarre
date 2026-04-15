/**
 * Service de recherche web — DuckDuckGo + Wikipedia FR + Wikipedia EN
 * Utilise le module https natif (bypass fetch/undici/proxy Windows).
 */
const https = require('https')

const TIMEOUT_MS = 8000

// ─── HTTP GET helper ──────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path    : urlObj.pathname + urlObj.search,
      method  : 'GET',
      headers : { 'User-Agent': 'BulbizarreSearch/1.0', Accept: 'application/json' },
    }

    const req = https.request(options, (res) => {
      // Suivre les redirects (301/302)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject)
      }

      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (_) { resolve(data) }
      })
    })

    req.on('error', reject)
    req.setTimeout(TIMEOUT_MS, () => { req.destroy(new Error('Search timeout')) })
    req.end()
  })
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

// ─── Sources ──────────────────────────────────────────────────────────────────

async function searchDuckDuckGo(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const data = await httpsGet(url)
  if (typeof data !== 'object') return []

  const sources = []
  if (data.AbstractText && data.AbstractURL) {
    sources.push({
      title  : data.Heading || query,
      url    : data.AbstractURL,
      snippet: data.AbstractText.substring(0, 400),
    })
  }
  for (const topic of (data.RelatedTopics || []).slice(0, 2)) {
    if (!topic.FirstURL || !topic.Text) continue
    sources.push({
      title  : topic.Text.split(' - ')[0].substring(0, 100),
      url    : topic.FirstURL,
      snippet: topic.Text.substring(0, 250),
    })
  }
  return sources
}

async function searchWikipediaLang(query, lang = 'fr') {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3`
  const searchData = await httpsGet(searchUrl)
  const pages = searchData.query?.search || []

  const sources = []
  for (const page of pages.slice(0, 2)) {
    try {
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
      const summary = await httpsGet(summaryUrl)
      if (!summary.extract || summary.extract.length < 50) continue
      sources.push({
        title  : summary.title,
        url    : summary.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        snippet: summary.extract.substring(0, 400),
      })
    } catch (_) { /* continuer */ }
  }
  return sources
}

async function searchWeb(query) {
  const results = await Promise.allSettled([
    withTimeout(searchDuckDuckGo(query),          TIMEOUT_MS),
    withTimeout(searchWikipediaLang(query, 'fr'), TIMEOUT_MS),
    withTimeout(searchWikipediaLang(query, 'en'), TIMEOUT_MS),
  ])

  const sources = []
  for (const r of results) {
    if (r.status === 'fulfilled') sources.push(...r.value)
  }

  const seen = new Set()
  return sources
    .filter((s) => {
      if (!s.url || !s.snippet || s.snippet.length < 40) return false
      if (seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })
    .slice(0, 5)
}

module.exports = { searchWeb }
