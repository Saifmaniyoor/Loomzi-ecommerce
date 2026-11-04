const router = require("express").Router();
const requireUser = require("../middleware/requireUser");
const { getMyWallet } = require("../controllers/walletController");
router.get("/", requireUser, getMyWallet);
module.exports = router;
