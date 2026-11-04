const router = require("express").Router();
const requireAdmin = require("../middleware/requireAdmin");
const { getAdminWallet } = require("../controllers/walletController");
router.get("/:userId", requireAdmin, getAdminWallet);
module.exports = router;
