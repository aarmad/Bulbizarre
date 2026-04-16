const { Router } = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} = require("../controllers/UserController");

const router = Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/password", authMiddleware, changePassword);
router.delete("/account", authMiddleware, deleteAccount);

module.exports = router;
