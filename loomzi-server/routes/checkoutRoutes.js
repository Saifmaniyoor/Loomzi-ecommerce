
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

// NEW: Pending order controller
const {
  createPendingOrder,
} = require("../controllers/pendingOrderController");

// Checkout preview
router.post(
  "/preview",
  requireUser,
  previewCheckout
);

// Prepare checkout attempt
router.post(
  "/prepare",
  requireUser,
  prepareCheckoutAttempt
);

// Validate payment checkout
router.post(
  "/validate-payment",
  requireUser,
  validatePaymentCheckout
);

// NEW: Create pending order and reserve stock
router.post(
  "/pending-order",
  requireUser,
  createPendingOrder
);

module.exports = router;
