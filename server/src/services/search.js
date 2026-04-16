/**
 * Service de recherche web — DuckDuckGo + Wikipedia FR + Wikipedia EN
 * Amélioration : recherche les entités clés (mots capitalisés) en plus de la query complète
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

// ─── Extraction des entités clés (noms propres, termes importants) ────────────

function extractKeyTerms(query) {
  // Supprime les mots communs français et extrait les termes significatifs
  const stopwords = new Set([
    'le','la','les','un','une','des','est','sont','a','de','du','en','et','ou',
    'au','aux','ce','cet','cette','ces','il','elle','ils','elles','on','que',
    'qui','quoi','comment','pourquoi','quand','où','quel','quelle','quels','quelles',
    'avec','sans','pour','par','sur','sous','dans','entre','vers','mais','donc',
    'car','ni','si','je','tu','nous','vous','me','te','se','lui','leur','leurs',
    'bien','très','plus','moins','aussi','encore','toujours','jamais','pas','ne',
    'avoir','être','fait','fait','été','vrai','faux','réel','vraiment',
    'est-ce','est','avait','avait','peut','pouvait','doit','devait',
    'il','elle','ils','elles','on','y','en',
    'a-t-il','a-t-elle','ont-ils','ont-elles',
  ])

  const words = query
    .replace(/[?!.,;:«»"'()]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !stopwords.has(w.toLowerCase()))

  // Favorise les mots capitalisés (noms propres)
  const capitalized = words.filter(w => /^[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ]/.test(w))
  const keyTerms    = capitalized.length > 0 ? capitalized : words

  return [...new Set(keyTerms)].slice(0, 4).join(' ')
}

// ─── Sources ──────────────────────────────────────────────────────────────────

async function searchDuckDuckGo(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const data = await httpsGet(url)
  if (typeof data !== 'object') return []

  const sources = []
  if (data.AbstractText && data.AbstractURL && data.AbstractText.length > 50) {
    sources.push({
      title  : data.Heading || query,
      url    : data.AbstractURL,
      snippet: data.AbstractText.substring(0, 500),
    })
  }
  // Réponse directe (Answer)
  if (data.Answer && data.AnswerType) {
    sources.push({
      title  : `Réponse directe : ${data.AnswerType}`,
      url    : data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      snippet: String(data.Answer).substring(0, 300),
    })
  }
  for (const topic of (data.RelatedTopics || []).slice(0, 3)) {
    if (!topic.FirstURL || !topic.Text || topic.Text.length < 40) continue
    sources.push({
      title  : topic.Text.split(' - ')[0].substring(0, 100),
      url    : topic.FirstURL,
      snippet: topic.Text.substring(0, 300),
    })
  }
  return sources
}

async function searchWikipediaLang(query, lang = 'fr') {
  // Étape 1 : recherche
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&srprop=snippet`
  const searchData = await httpsGet(searchUrl)
  const pages = searchData?.query?.search || []

  const sources = []
  for (const page of pages.slice(0, 3)) {
    try {
      // Étape 2 : résumé complet via REST (plus riche que le snippet de l'API)
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
      const summary = await httpsGet(summaryUrl)
      if (!summary.extract || summary.extract.length < 80) continue

      sources.push({
        title  : summary.title,
        url    : summary.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        snippet: summary.extract.substring(0, 500),
      })
    } catch (_) { /* continuer */ }
  }
  return sources
}

async function searchWeb(query) {
  // Recherche parallèle : query complète + entités clés pour Wikipedia
  const keyTerms = extractKeyTerms(query)
  const useKeyTerms = keyTerms.length > 3 && keyTerms.toLowerCase() !== query.toLowerCase()

  console.log(`[Search] Query: "${query}" | KeyTerms: "${keyTerms}"`)

  const tasks = [
    withTimeout(searchDuckDuckGo(query),          TIMEOUT_MS),
    withTimeout(searchWikipediaLang(query, 'fr'), TIMEOUT_MS),
    withTimeout(searchWikipediaLang(query, 'en'), TIMEOUT_MS),
  ]

  // Si les entités clés diffèrent de la query, on fait une recherche supplémentaire
  if (useKeyTerms) {
    tasks.push(withTimeout(searchWikipediaLang(keyTerms, 'fr'), TIMEOUT_MS))
    tasks.push(withTimeout(searchWikipediaLang(keyTerms, 'en'), TIMEOUT_MS))
  }

  const results = await Promise.allSettled(tasks)

  const sources = []
  for (const r of results) {
    if (r.status === 'fulfilled') sources.push(...r.value)
  }

  // Déduplication par URL, filtre les snippets trop courts
  const seen = new Set()
  const filtered = sources.filter((s) => {
    if (!s.url || !s.snippet || s.snippet.length < 60) return false
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })

  console.log(`[Search] ${filtered.length} sources trouvées`)
  return filtered.slice(0, 6)
}

module.exports = { searchWeb }
