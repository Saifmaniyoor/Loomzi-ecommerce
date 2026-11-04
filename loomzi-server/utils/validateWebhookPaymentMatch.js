
const {
  validateRazorpayWebhookPayload,
} = require("./razorpayWebhookPayload");

// ==========================================
// VALIDATE RAZORPAY WEBHOOK PAYMENT MATCH
// ==========================================

// This function compares a stored webhook
// event with the payment being confirmed.
//
// IMPORTANT:
// amountInPaise must come from trusted
// backend order data.
//
// Razorpay-only:
//   Full order amount.
//
// Wallet + Razorpay:
//   Razorpay contribution only.
//
// Wallet-only payments must not call
// this function.

const validateWebhookPaymentMatch = ({
  event,
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
}) => {
  // 1. Verify webhook event type
  if (
    !event ||
    event.eventType !== "payment.captured"
  ) {
    return {
      valid: false,
      reason: "Invalid webhook event type",
    };
  }

  // 2. Validate expected payment identifiers
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId) ||
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpayPaymentId)
  ) {
    return {
      valid: false,
      reason: "Invalid expected Razorpay identifiers",
    };
  }

  // 3. Validate expected Razorpay amount
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    return {
      valid: false,
      reason: "Invalid expected Razorpay amount",
    };
  }

  // 4. Validate stored webhook payload
  const validation =
    validateRazorpayWebhookPayload(
      event.payload
    );

  if (
    !validation.valid ||
    validation.eventType !== "payment.captured"
  ) {
    return {
      valid: false,
      reason: "Invalid captured-payment payload",
    };
  }

  // 5. Compare Razorpay order ID
  if (
    validation.razorpayOrderId !==
    razorpayOrderId
  ) {
    return {
      valid: false,
      reason: "Razorpay order ID mismatch",
    };
  }

  // 6. Compare Razorpay payment ID
  if (
    validation.razorpayPaymentId !==
    razorpayPaymentId
  ) {
    return {
      valid: false,
      reason: "Razorpay payment ID mismatch",
    };
  }

  // 7. Compare exact captured amount
  //
  // For split payments, this must equal
  // paymentBreakdown.razorpayPaise,
  // NOT the full Loomzi order total.
  if (
    !Number.isSafeInteger(
      validation.amountInPaise
    ) ||
    validation.amountInPaise !==
      amountInPaise
  ) {
    return {
      valid: false,
      reason: "Razorpay payment amount mismatch",
    };
  }

  // 8. Currency and captured status
  // have already been validated by
  // validateRazorpayWebhookPayload.

  return {
    valid: true,
    reason: null,
  };
};

module.exports = {
  validateWebhookPaymentMatch,
};
