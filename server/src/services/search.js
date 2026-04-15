/**
 * Service de recherche web — DuckDuckGo + Wikipedia FR + Wikipedia EN
 * Aucune clé API requise.
 */

const TIMEOUT_MS = 8000

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ])
}

/** DuckDuckGo Instant Answer API */
async function searchDuckDuckGo(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`
  const res = await fetch(url)
  const data = await res.json()

  const sources = []
  if (data.AbstractText && data.AbstractURL) {
    sources.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText.substring(0, 400),
    })
  }
  for (const topic of (data.RelatedTopics || []).slice(0, 2)) {
    if (!topic.FirstURL || !topic.Text) continue
    sources.push({
      title: topic.Text.split(' - ')[0].substring(0, 100),
      url: topic.FirstURL,
      snippet: topic.Text.substring(0, 250),
    })
  }
  return sources
}

/** Wikipedia Search + Summary pour une langue donnée */
async function searchWikipediaLang(query, lang = 'fr') {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&origin=*`
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()
  const pages = searchData.query?.search || []

  const sources = []
  for (const page of pages.slice(0, 2)) {
    try {
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
      const summaryRes = await fetch(summaryUrl)
      if (!summaryRes.ok) continue
      const summary = await summaryRes.json()
      if (!summary.extract || summary.extract.length < 50) continue

      sources.push({
        title: summary.title,
        url: summary.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        snippet: summary.extract.substring(0, 400),
      })
    } catch (_) { /* continuer */ }
  }
  return sources
}

/**
 * Recherche multi-sources : DuckDuckGo + Wikipedia FR + Wikipedia EN
 * Retourne jusqu'à 5 sources pertinentes dédupliquées.
 */
async function searchWeb(query) {
  const results = await Promise.allSettled([
    withTimeout(searchDuckDuckGo(query), TIMEOUT_MS),
    withTimeout(searchWikipediaLang(query, 'fr'), TIMEOUT_MS),
    withTimeout(searchWikipediaLang(query, 'en'), TIMEOUT_MS),
  ])

  const sources = []
  for (const r of results) {
    if (r.status === 'fulfilled') sources.push(...r.value)
  }

  // Dédupliquer par URL et filtrer les snippets trop courts
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
