const express = require("express");
const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");

// Protect all customer cart routes
router.use(requireUser);

router.get("/", getCart);

router.post("/items", addToCart);

router.patch("/items/:itemId", updateCartItem);

router.delete("/items/:itemId", removeCartItem);

router.delete("/", clearCart);

module.exports = router;