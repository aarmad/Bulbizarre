const HFService = require('../services/HFService')
const History = require('../models/History')

const handleChat = async (req, res) => {
  const { query, userId } = req.body

  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'La question est requise.' })
  }

  try {
    const { result, sources } = await HFService.checkInformation(query.trim())

    if (userId) {
      await History.create({
        userId,
        type: 'chat',
        content: { query, response: result, sources },
      })
    }

    res.json({ result, sources })
  } catch (error) {
    console.error('handleChat error:', error.message)
    res.status(500).json({ error: "Erreur lors de la vérification. Réessayez dans quelques instants." })
  }
}

const handleURLVerify = async (req, res) => {
  const { url, userId } = req.body

  if (!url || !url.trim()) {
    return res.status(400).json({ error: "L'URL est requise." })
  }

  try {
    const result = await HFService.scoreArticleCredibility(url.trim())

    if (userId) {
      await History.create({
        userId,
        type: 'url_verify',
        content: { url, result },
      })
    }

    res.json(result)
  } catch (error) {
    console.error('handleURLVerify error:', error.message)
    res.status(500).json({ error: "Erreur lors de l'analyse de l'article." })
  }
}

const handleHistory = async (req, res) => {
  const { userId } = req.query

  if (!userId) {
    return res.status(400).json({ error: 'userId requis.' })
  }

  try {
    const entries = await History.find({ userId })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean()

    res.json(entries)
  } catch (error) {
    console.error('handleHistory error:', error.message)
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique." })
  }
}

module.exports = { handleChat, handleURLVerify, handleHistory }
