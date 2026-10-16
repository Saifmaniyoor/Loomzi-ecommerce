
const {
  verifyRecoveredWebhookPayment,
} = require("./webhookRecoveryVerificationServices");

// Inspect a stored webhook and decide its next action.
//
// READ-ONLY:
// Does not update orders, stock reservations,
// checkout attempts, or webhook events.
//
// IMPORTANT:
// A readyForConfirmation result is advisory.
// The payment confirmation transaction must
// still enforce webhook ownership and matching.

const evaluateWebhookRecovery = async (eventId) => {
  // 1. Verify the stored webhook payment
  // directly with Razorpay.
  const verification =
    await verifyRecoveredWebhookPayment(eventId);

  // 2. Stop if verification was unsuccessful.
  if (!verification.verified) {
    return {
      readyForConfirmation: false,
      alreadyPaid: false,
      requiresReconciliation: true,
      reason:
        verification.reason ||
        "Payment verification unsuccessful",
    };
  }

  // 3. Prepare the verified payment details.
  const paymentDetails = {
    eventId: verification.eventId,
    orderId: verification.orderId,
    userId: verification.userId,
    razorpayOrderId: verification.razorpayOrderId,
    razorpayPaymentId: verification.razorpayPaymentId,
    amountInPaise: verification.amountInPaise,
  };

  // 4. The same payment was already confirmed
  // in Loomzi.
  if (verification.alreadyPaid) {
    return {
      readyForConfirmation: false,
      alreadyPaid: true,
      requiresReconciliation: false,
      ...paymentDetails,
      reason: "Order payment already confirmed",
    };
  }

  // 5. Captured payment verified with Razorpay.
  // Controlled transaction processing is needed.
  return {
    readyForConfirmation: true,
    alreadyPaid: false,
    requiresReconciliation: false,
    ...paymentDetails,
  };
};

module.exports = {
  evaluateWebhookRecovery,
};
