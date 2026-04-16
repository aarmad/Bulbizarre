const HFService = require("../services/HFService");
const History = require("../models/History");

const handleChat = async (req, res) => {
  const { query, userId } = req.body;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "La question est requise." });
  }

  try {
    const { result, sources } = await HFService.checkInformation(query.trim());

    if (userId) {
      await History.create({
        userId,
        type: "chat",
        content: { query, response: result, sources },
      });
    }

    res.json({ result, sources });
  } catch (error) {
    console.error("handleChat error:", error.message);
    res
      .status(500)
      .json({
        error:
          "Erreur lors de la vérification. Réessayez dans quelques instants.",
      });
  }
};

const handleURLVerify = async (req, res) => {
  const { url, userId } = req.body;

  if (!url || !url.trim()) {
    return res.status(400).json({ error: "L'URL est requise." });
  }

  try {
    const result = await HFService.scoreArticleCredibility(url.trim());

    if (userId) {
      await History.create({
        userId,
        type: "url_verify",
        content: { url, result },
      });
    }

    res.json(result);
  } catch (error) {
    console.error("handleURLVerify error:", error.message);
    res.status(500).json({ error: "Erreur lors de l'analyse de l'article." });
  }
};

const handleHeadlineVerify = async (req, res) => {
  const { headline, userId } = req.body;

  if (!headline || !headline.trim()) {
    return res.status(400).json({ error: "Le titre est requis." });
  }

  try {
    const result = await HFService.verifyHeadline(headline.trim());

    if (userId) {
      await History.create({
        userId,
        type: "headline_verify",
        content: { headline, result },
      });
    }

    res.json(result);
  } catch (error) {
    console.error("handleHeadlineVerify error:", error.message);
    res.status(500).json({ error: "Erreur lors de la vérification du titre." });
  }
};

const handleHistory = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId requis." });
  }

  try {
    const entries = await History.find({ userId })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    res.json(entries);
  } catch (error) {
    console.error("handleHistory error:", error.message);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération de l'historique." });
  }
};

const handleSearchHistory = async (req, res) => {
  const { userId } = req.query;
  const { q } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId requis." });
  }

  if (!q || !q.trim()) {
    return res.status(400).json({ error: "Terme de recherche requis." });
  }

  try {
    const entries = await History.find({
      userId,
      $or: [
        { "content.headline": { $regex: q, $options: "i" } },
        { "content.query": { $regex: q, $options: "i" } },
        { "content.url": { $regex: q, $options: "i" } },
      ],
    })
      .sort({ timestamp: -1 })
      .lean();

    res.json(entries);
  } catch (error) {
    console.error("handleSearchHistory error:", error.message);
    res.status(500).json({ error: "Erreur lors de la recherche." });
  }
};

const handleDeleteHistoryEntry = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId requis." });
  }

  try {
    const result = await History.findOneAndDelete({ _id: id, userId });

    if (!result) {
      return res.status(404).json({ error: "Entrée non trouvée." });
    }

    res.json({ message: "Entrée supprimée." });
  } catch (error) {
    console.error("handleDeleteHistoryEntry error:", error.message);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
};

const handleClearHistory = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "userId requis." });
  }

  try {
    await History.deleteMany({ userId });

    res.json({ message: "Historique vidé." });
  } catch (error) {
    console.error("handleClearHistory error:", error.message);
    res
      .status(500)
      .json({ error: "Erreur lors du nettoyage de l'historique." });
  }
};

module.exports = {
  handleChat,
  handleURLVerify,
  handleHeadlineVerify,
  handleHistory,
  handleSearchHistory,
  handleDeleteHistoryEntry,
  handleClearHistory,
};
