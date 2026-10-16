
const {
  validateRazorpayWebhookPayload,
} = require("./razorpayWebhookPayload");

const validateWebhookPaymentMatch = ({
  event,
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
}) => {
  // 1. Only captured-payment webhooks can
  // confirm an order.
  if (
    !event ||
    event.eventType !== "payment.captured"
  ) {
    return {
      valid: false,
      reason: "Invalid webhook event type",
    };
  }

  // 2. Validate the stored webhook payload.
  const validation =
    validateRazorpayWebhookPayload(event.payload);

  if (
    !validation.valid ||
    validation.eventType !== "payment.captured"
  ) {
    return {
      valid: false,
      reason: "Invalid captured-payment payload",
    };
  }

  // 3. Compare the webhook's Razorpay order ID
  // with the order being confirmed.
  if (
    validation.razorpayOrderId !== razorpayOrderId
  ) {
    return {
      valid: false,
      reason: "Razorpay order ID mismatch",
    };
  }

  // 4. Compare the Razorpay payment IDs.
  if (
    validation.razorpayPaymentId !== razorpayPaymentId
  ) {
    return {
      valid: false,
      reason: "Razorpay payment ID mismatch",
    };
  }

  // 5. Compare the payment amount in paise.
  if (
    !Number.isSafeInteger(amountInPaise) ||
    validation.amountInPaise !== amountInPaise
  ) {
    return {
      valid: false,
      reason: "Payment amount mismatch",
    };
  }

  // Currency INR and captured status have
  // already been checked by the validator.

  return {
    valid: true,
    reason: null,
  };
};

module.exports = {
  validateWebhookPaymentMatch,
};
