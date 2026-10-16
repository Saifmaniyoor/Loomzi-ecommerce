
const SUPPORTED_EVENTS = new Set([
  "payment.captured",
  "payment.failed",
  "order.paid",
]);

const isValidRazorpayId = (value, prefix) => {
  return (
    typeof value === "string" &&
    new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value)
  );
};

const validateRazorpayWebhookPayload = (payload) => {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return {
      valid: false,
      message: "Invalid webhook payload",
    };
  }

  const eventType = payload.event;

  if (!SUPPORTED_EVENTS.has(eventType)) {
    return {
      valid: false,
      unsupported: true,
      message: "Unsupported webhook event",
    };
  }

  if (eventType === "order.paid") {
    const order = payload.payload?.order?.entity;

    if (
      !order ||
      !isValidRazorpayId(order.id, "order") ||
      !Number.isSafeInteger(order.amount) ||
      order.amount < 100 ||
      order.currency !== "INR" ||
      order.status !== "paid"
    ) {
      return {
        valid: false,
        message: "Invalid order.paid payload",
      };
    }

    return {
      valid: true,
      eventType,
      razorpayOrderId: order.id,
      amountInPaise: order.amount,
    };
  }

  const payment = payload.payload?.payment?.entity;

  if (
    !payment ||
    !isValidRazorpayId(payment.id, "pay") ||
    !isValidRazorpayId(payment.order_id, "order") ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount < 100 ||
    payment.currency !== "INR"
  ) {
    return {
      valid: false,
      message: "Invalid payment payload",
    };
  }

  if (
    eventType === "payment.captured" &&
    (payment.status !== "captured" ||
      payment.captured !== true)
  ) {
    return {
      valid: false,
      message: "Payment is not captured",
    };
  }

  if (
    eventType === "payment.failed" &&
    payment.status !== "failed"
  ) {
    return {
      valid: false,
      message: "Payment is not failed",
    };
  }

  return {
    valid: true,
    eventType,
    razorpayOrderId: payment.order_id,
    razorpayPaymentId: payment.id,
    amountInPaise: payment.amount,
  };
};

module.exports = {
  validateRazorpayWebhookPayload,
};
