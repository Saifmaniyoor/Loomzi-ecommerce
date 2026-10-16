
const express = require("express");
const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlistController");

// All wishlist routes require login
router.use(requireUser);

router.get("/", getWishlist);
router.post("/", addToWishlist);
router.delete("/:productId", removeFromWishlist);

module.exports = router;
