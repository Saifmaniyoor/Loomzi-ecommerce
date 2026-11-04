
const {
  verifyRecoveredWebhookPayment,
} = require("./webhookRecoveryVerificationServices");

// ==========================================
// EVALUATE WEBHOOK RECOVERY
// ==========================================

// READ-ONLY SERVICE.
//
// Supports:
// 1. Razorpay-only payments
// 2. Wallet + Razorpay split payments
//
// Wallet-only payments do not use
// Razorpay webhook recovery.
//
// IMPORTANT:
// readyForConfirmation is only a decision.
//
// The payment confirmation transaction
// must independently verify:
// - Order ownership
// - Razorpay payment identity
// - Expected Razorpay amount
// - Checkout attempt state
// - Stock reservation state
// - Wallet reservation state
// - Webhook processing token

const evaluateWebhookRecovery = async (eventId) => {
  // 1. Validate event ID
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    return {
      readyForConfirmation: false,
      alreadyPaid: false,
      requiresReconciliation: true,
      reason: "Invalid webhook event ID",
    };
  }

  // 2. Verify stored webhook payment
  // using Razorpay and trusted order data.
  const verification =
    await verifyRecoveredWebhookPayment(
      eventId.trim()
    );

  // 3. Stop if verification failed
  if (
    !verification ||
    verification.verified !== true ||
    verification.requiresReconciliation === true
  ) {
    return {
      readyForConfirmation: false,
      alreadyPaid: false,
      requiresReconciliation: true,
      reason:
        verification?.reason ||
        "Payment verification unsuccessful",
    };
  }

  // 4. Validate verified payment details
  if (
    !verification.eventId ||
    !verification.orderId ||
    !verification.userId ||
    typeof verification.razorpayOrderId !==
      "string" ||
    !/^order_[A-Za-z0-9]+$/.test(
      verification.razorpayOrderId
    ) ||
    typeof verification.razorpayPaymentId !==
      "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(
      verification.razorpayPaymentId
    ) ||
    !Number.isSafeInteger(
      verification.amountInPaise
    ) ||
    verification.amountInPaise < 100
  ) {
    return {
      readyForConfirmation: false,
      alreadyPaid: false,
      requiresReconciliation: true,
      reason:
        "Verified recovery payment details are incomplete",
    };
  }

  // 5. Validate verified capture information
  //
  // These values come from the Razorpay
  // verification service, not directly
  // from an untrusted webhook payload.
  if (
    verification.currency !== "INR" ||
    verification.paymentStatus !== "captured"
  ) {
    return {
      readyForConfirmation: false,
      alreadyPaid: false,
      requiresReconciliation: true,
      reason:
        "Recovered payment is not verified as captured in INR",
    };
  }

  // 6. Prepare verified payment details
  //
  // For Wallet + Razorpay:
  // amountInPaise is the Razorpay portion,
  // not the full order amount.
  const paymentDetails = {
    eventId: verification.eventId,
    orderId: verification.orderId,
    userId: verification.userId,
    razorpayOrderId:
      verification.razorpayOrderId,
    razorpayPaymentId:
      verification.razorpayPaymentId,
    amountInPaise:
      verification.amountInPaise,
  };

  // 7. Handle already-paid order
  //
  // The verification service must have
  // confirmed that the existing order
  // belongs to this exact payment.
  //
  // For split payments, the matching
  // service also checks that the wallet
  // contribution is already settled.
  if (verification.alreadyPaid === true) {
    return {
      readyForConfirmation: false,
      alreadyPaid: true,
      requiresReconciliation: false,
      ...paymentDetails,
      reason:
        "Order payment already confirmed",
    };
  }

  // 8. Payment verified and order pending
  //
  // Final confirmation is performed by
  // the MongoDB transaction.
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
