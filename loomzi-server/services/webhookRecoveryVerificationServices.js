
const {
  inspectWebhookEvent,
} = require("./webhookRecoveryInspectionServices");

const {
  verifyWebhookCapturedPayment,
} = require("./webhookPaymentReconciliationServices");

// Inspect a stored webhook and verify its payment
// directly with Razorpay.
//
// READ-ONLY:
// Does not update orders, stock or webhook statuses.

const verifyRecoveredWebhookPayment = async (
  eventId
) => {
  // 1. Inspect the stored webhook event
  const inspection = await inspectWebhookEvent(eventId);

  if (!inspection.found) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason: "Webhook event not found",
    };
  }

  // 2. Ensure the payload can be inspected
  if (!inspection.canInspectPayment) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        inspection.reason ||
        "Webhook payload cannot be inspected",
    };
  }

  // 3. Only captured-payment events are handled
  // by this verification service.
  if (inspection.eventType !== "payment.captured") {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        "This service only verifies payment.captured events",
    };
  }

  // 4. Extract stored payment details
  const {
    razorpayOrderId,
    razorpayPaymentId,
    amountInPaise,
  } = inspection.paymentDetails;

  if (!razorpayPaymentId) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason: "Razorpay payment ID is missing",
    };
  }

  // 5. Verify the payment against Razorpay
  // and match it to a Loomzi order.
  try {
    const verification =
      await verifyWebhookCapturedPayment({
        razorpayOrderId,
        razorpayPaymentId,
        amountInPaise,
      });

    if (!verification || !verification.verified) {
      return {
        verified: false,
        requiresReconciliation: true,
        reason:
          verification?.reason ||
          "Payment verification unsuccessful",
      };
    }

    // 6. Return verified order information
    return {
      verified: true,
      requiresReconciliation: false,
      eventId: inspection.eventId,
      eventType: inspection.eventType,
      orderId: verification.orderId,
      userId: verification.userId,
      razorpayOrderId: verification.razorpayOrderId,
      razorpayPaymentId: verification.razorpayPaymentId,
      amountInPaise: verification.amountInPaise,
      alreadyPaid: verification.alreadyPaid,
    };
  } catch (error) {
    // Network or provider errors are uncertain.
    // Never interpret them as payment failure.
    console.error(
      "Recovered webhook verification error:",
      error.message
    );

    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        "Unable to verify payment with Razorpay",
    };
  }
};

module.exports = {
  verifyRecoveredWebhookPayment,
};
