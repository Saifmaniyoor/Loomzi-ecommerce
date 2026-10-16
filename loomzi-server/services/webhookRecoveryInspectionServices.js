
const {
  findWebhookEventById,
} = require("./webhookEventServices");

const {
  validateRazorpayWebhookPayload,
} = require("../utils/razorpayWebhookPayload");

const inspectWebhookEvent = async (eventId) => {
  // 1. Find the stored webhook event
  const event = await findWebhookEventById(eventId);

  if (!event) {
    return {
      found: false,
      canInspectPayment: false,
      reason: "Webhook event not found",
    };
  }

  // 2. Check whether payload exists
  if (!event.payload) {
    return {
      found: true,
      eventId: event.eventId,
      status: event.status,
      canInspectPayment: false,
      reason: "Stored webhook payload is missing",
    };
  }

  // 3. Validate stored payload structure
  const validation = validateRazorpayWebhookPayload(
    event.payload
  );

  if (!validation.valid) {
    return {
      found: true,
      eventId: event.eventId,
      status: event.status,
      canInspectPayment: false,
      reason:
        validation.message ||
        "Stored webhook payload is invalid or unsupported",
    };
  }

  // 4. Check that event types match
  if (validation.eventType !== event.eventType) {
    return {
      found: true,
      eventId: event.eventId,
      status: event.status,
      canInspectPayment: false,
      reason: "Stored webhook event type mismatch",
    };
  }

  // 5. Return information for further inspection
  return {
    found: true,
    eventId: event.eventId,
    eventType: event.eventType,
    status: event.status,
    attempts: event.attempts,
    canInspectPayment: true,
    paymentDetails: {
      razorpayOrderId: validation.razorpayOrderId,
      razorpayPaymentId:
        validation.razorpayPaymentId || null,
      amountInPaise: validation.amountInPaise,
    },
  };
};

module.exports = {
  inspectWebhookEvent,
};
