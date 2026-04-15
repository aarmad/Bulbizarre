const { Router } = require("express");
const {
  getDashboardStats,
  getMyStats,
} = require("../controllers/StatsController");

const router = Router();

router.get("/dashboard", getDashboardStats);
router.get("/my-stats", getMyStats);

module.exports = router;
