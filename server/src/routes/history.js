const { Router } = require("express");
const {
  getHistory,
  getHistoryById,
  deleteHistoryEntry,
  clearHistory,
  searchHistory,
} = require("../controllers/HistoryController");

const router = Router();

router.get("/", getHistory);
router.get("/search", searchHistory);
router.get("/:id", getHistoryById);
router.delete("/:id", deleteHistoryEntry);
router.delete("/", clearHistory);

module.exports = router;
