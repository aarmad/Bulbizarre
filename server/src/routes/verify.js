const { Router } = require("express");
const {
  handleChat,
  handleURLVerify,
  handleHeadlineVerify,
} = require("../controllers/VerifyController");

const router = Router();

router.post("/chat", handleChat);
router.post("/url", handleURLVerify);
router.post("/headline", handleHeadlineVerify);

module.exports = router;
