
const express = require("express");
const requireUser = require("../middleware/requireUser");

const {
  getMyOrders,
  getOrderById,
  cancelOrder,
} = require("../controllers/orderController");

const router = express.Router();

// Get all orders of logged-in customer
router.get("/", requireUser, getMyOrders);

// Cancel an order
router.patch("/:orderId/cancel", requireUser, cancelOrder);

// Get details of a specific order
router.get("/:orderId", requireUser, getOrderById);

module.exports = router;
