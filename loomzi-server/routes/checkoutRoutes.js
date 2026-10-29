
const express = require("express");

const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  previewCheckout,
} = require("../controllers/checkoutController");

const {
  prepareCheckoutAttempt,
} = require("../controllers/checkoutAttemptController");

const {
  validatePaymentCheckout,
} = require("../controllers/paymentCheckoutController");

const {
  createPendingOrder,
} = require("../controllers/pendingOrderController");

// NEW: COD checkout controller
const {
  placeCODOrder,
  getCODCheckoutStatus,
} = require("../controllers/codCheckoutController");

// ======================================
// Checkout Preview
// ======================================

router.post(
  "/preview",
  requireUser,
  previewCheckout
);

// ======================================
// Prepare Checkout Attempt
// ======================================

router.post(
  "/prepare",
  requireUser,
  prepareCheckoutAttempt
);

// ======================================
// Validate Razorpay Checkout
// ======================================

router.post(
  "/validate-payment",
  requireUser,
  validatePaymentCheckout
);

// ======================================
// Create Pending Razorpay Order
// ======================================

router.post(
  "/pending-order",
  requireUser,
  createPendingOrder
);

// ======================================
// Place COD Order
// ======================================

router.post(
  "/cod",
  requireUser,
  placeCODOrder
);

// ======================================
// Check Previous COD Checkout Status
// ======================================

router.get(
  "/cod/status",
  requireUser,
  getCODCheckoutStatus
);

const { createCheckoutRazorpayOrder, getRazorpayCheckoutStatus } = require("../controllers/razorpayOrderController");
router.post("/razorpay/order", requireUser, createCheckoutRazorpayOrder);
router.get("/razorpay/status/:orderId", requireUser, getRazorpayCheckoutStatus);
module.exports = router;
