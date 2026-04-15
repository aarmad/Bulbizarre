const History = require("../models/History");

// GET - Récupérer tout l'historique paginé
const getHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await History.countDocuments({ userId });
    const history = await History.find({ userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      total,
      page,
      pages: Math.ceil(total / limit),
      data: history,
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération de l'historique" });
  }
};

// GET - Détails d'une vérification
const getHistoryById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const entry = await History.findOne({ _id: id, userId });

    if (!entry) {
      return res.status(404).json({ error: "Vérification non trouvée" });
    }

    res.json(entry);
  } catch (error) {
    console.error("Error fetching history entry:", error);
    res.status(500).json({ error: "Erreur lors de la récupération" });
  }
};

// DELETE - Supprimer une vérification
const deleteHistoryEntry = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const entry = await History.findOneAndDelete({ _id: id, userId });

    if (!entry) {
      return res.status(404).json({ error: "Vérification non trouvée" });
    }

    res.json({ message: "Vérification supprimée" });
  } catch (error) {
    console.error("Error deleting history entry:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
};

// DELETE - Vider tout l'historique
const clearHistory = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    await History.deleteMany({ userId });

    res.json({ message: "Historique vidé" });
  } catch (error) {
    console.error("Error clearing history:", error);
    res.status(500).json({ error: "Erreur lors du nettoyage" });
  }
};

// GET - Chercher dans l'historique
const searchHistory = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { q } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Requête de recherche requise" });
    }

    const results = await History.find({
      userId,
      $or: [
        { "content.headline": { $regex: q, $options: "i" } },
        { "content.query": { $regex: q, $options: "i" } },
        { "content.url": { $regex: q, $options: "i" } },
      ],
    }).sort({ timestamp: -1 });

    res.json(results);
  } catch (error) {
    console.error("Error searching history:", error);
    res.status(500).json({ error: "Erreur lors de la recherche" });
  }
};

module.exports = {
  getHistory,
  getHistoryById,
  deleteHistoryEntry,
  clearHistory,
  searchHistory,
};
