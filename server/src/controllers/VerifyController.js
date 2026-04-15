const HFService = require("../services/HFService");
const History = require("../models/History");

const handleChat = async (req, res) => {
  try {
    const { query, userId } = req.body;
    const result = await HFService.checkInformation(query);

    if (userId) {
      const entry = new History({
        userId,
        type: "chat",
        content: { query, response: result },
      });
      await entry.save();
    }

    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: "Error in chatbot verification" });
  }
};

const handleHeadlineVerify = async (req, res) => {
  try {
    const { headline, userId } = req.body;

    if (!headline || headline.trim().length === 0) {
      return res.status(400).json({ error: "Headline is required" });
    }

    const result = await HFService.verifyHeadline(headline);

    if (userId) {
      const entry = new History({
        userId,
        type: "headline_verify",
        content: { headline, result },
      });
      await entry.save();
    }

    res.json(result);
  } catch (error) {
    console.error("Headline verification error:", error);
    res.status(500).json({ error: "Error in headline verification" });
  }
};

const handleURLVerify = async (req, res) => {
  try {
    const { url, userId } = req.body;
    const result = await HFService.scoreArticleCredibility(url);

    if (userId) {
      const entry = new History({
        userId,
        type: "url_verify",
        content: { url, result },
      });
      await entry.save();
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Error in URL verification" });
  }
};

module.exports = { handleChat, handleURLVerify, handleHeadlineVerify };
