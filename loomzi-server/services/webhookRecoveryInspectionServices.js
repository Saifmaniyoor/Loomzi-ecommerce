
const {
  findWebhookEventById,
} = require("./webhookEventServices");

const {
  validateRazorpayWebhookPayload,
} = require("../utils/razorpayWebhookPayload");

// ==========================================
// INSPECT STORED WEBHOOK EVENT
// ==========================================

// READ-ONLY SERVICE.
//
// Supports inspection of:
// - Razorpay-only payment webhooks
// - Wallet + Razorpay payment webhooks
//
// Wallet-only payments do not use
// Razorpay payment.captured webhooks.
//
// The webhook amount represents the
// Razorpay contribution.
//
// This service does NOT:
// - Verify payment with Razorpay's API
// - Confirm an order
// - Settle or release wallet funds
// - Update stock
// - Update webhook status

const inspectWebhookEvent = async (eventId) => {
  // 1. Validate event ID
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    return {
      found: false,
      canInspectPayment: false,
      reason: "Invalid webhook event ID",
    };
  }

  // 2. Find stored webhook event
  const event = await findWebhookEventById(
    eventId.trim()
  );

  if (!event) {
    return {
      found: false,
      canInspectPayment: false,
      reason: "Webhook event not found",
    };
  }

  // 3. Check stored event type
  if (event.eventType !== "payment.captured") {
    return {
      found: true,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      canInspectPayment: false,
      reason:
        "Only payment.captured events are supported",
    };
  }

  // 4. Check whether payload exists
  if (!event.payload) {
    return {
      found: true,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      canInspectPayment: false,
      reason: "Stored webhook payload is missing",
    };
  }

  // 5. Validate stored payload structure
  const validation =
    validateRazorpayWebhookPayload(
      event.payload
    );

  if (!validation || validation.valid !== true) {
    return {
      found: true,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      canInspectPayment: false,
      reason:
        validation?.message ||
        "Stored webhook payload is invalid",
    };
  }

  // 6. Check event type consistency
  if (
    validation.eventType !== event.eventType
  ) {
    return {
      found: true,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      canInspectPayment: false,
      reason:
        "Stored webhook event type mismatch",
    };
  }

  // 7. Validate payment identifiers
  if (
    typeof validation.razorpayOrderId !==
      "string" ||
    !/^order_[A-Za-z0-9]+$/.test(
      validation.razorpayOrderId
    ) ||
    typeof validation.razorpayPaymentId !==
      "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(
      validation.razorpayPaymentId
    )
  ) {
    return {
      found: true,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      canInspectPayment: false,
      reason:
        "Stored webhook payment identifiers are invalid",
    };
  }

  // 8. Validate captured amount
  //
  // For Wallet + Razorpay orders,
  // this is the Razorpay portion only.
  if (
    !Number.isSafeInteger(
      validation.amountInPaise
    ) ||
    validation.amountInPaise < 100
  ) {
    return {
      found: true,
      eventId: event.eventId,
      eventType: event.eventType,
      status: event.status,
      canInspectPayment: false,
      reason:
        "Stored webhook payment amount is invalid",
    };
  }

  // 9. Return inspected payment details
  //
  // These details are not yet independently
  // verified with Razorpay.
  return {
    found: true,
    eventId: event.eventId,
    eventType: event.eventType,
    status: event.status,
    attempts: event.attempts,
    canInspectPayment: true,
    paymentDetails: {
      razorpayOrderId:
        validation.razorpayOrderId,
      razorpayPaymentId:
        validation.razorpayPaymentId,
      amountInPaise:
        validation.amountInPaise,
    },
  };
};

module.exports = {
  inspectWebhookEvent,
};
