const { Router } = require("express");
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} = require("../controllers/UserController");

const router = Router();

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/password", changePassword);
router.delete("/account", deleteAccount);

module.exports = router;
