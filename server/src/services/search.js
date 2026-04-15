/**
 * Service de recherche web — combine DuckDuckGo (réponses instantanées)
 * et l'API Wikipedia pour fournir du contexte factuel au LLM.
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

/** DuckDuckGo Instant Answer API — renvoie des faits Wikipedia + topics liés */
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

  for (const topic of data.RelatedTopics || []) {
    if (!topic.FirstURL || !topic.Text) continue
    sources.push({
      title: topic.Text.split(' - ')[0].substring(0, 100),
      url: topic.FirstURL,
      snippet: topic.Text.substring(0, 250),
    })
    if (sources.length >= 3) break
  }

  return sources
}

/** Wikipedia Search + Summary API — source factuelle fiable */
async function searchWikipedia(query) {
  const sources = []

  // 1. Chercher les pages correspondantes
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&origin=*`
  const searchRes = await fetch(searchUrl)
  const searchData = await searchRes.json()
  const pages = searchData.query?.search || []

  // 2. Récupérer les résumés des 2 premières pages
  for (const page of pages.slice(0, 2)) {
    try {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`
      const summaryRes = await fetch(summaryUrl)
      if (!summaryRes.ok) continue
      const summary = await summaryRes.json()

      sources.push({
        title: summary.title,
        url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        snippet: summary.extract?.substring(0, 400) || page.snippet.replace(/<[^>]*>/g, ''),
      })
    } catch (_) {
      // continuer si une page échoue
    }
  }

  return sources
}

/**
 * Recherche multi-sources combinée.
 * Retourne jusqu'à 5 sources triées par pertinence.
 */
async function searchWeb(query) {
  const results = await Promise.allSettled([
    withTimeout(searchDuckDuckGo(query), TIMEOUT_MS),
    withTimeout(searchWikipedia(query), TIMEOUT_MS),
  ])

  const sources = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      sources.push(...result.value)
    }
  }

  // Dédupliquer par URL
  const seen = new Set()
  return sources.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  }).slice(0, 5)
}

module.exports = { searchWeb }
