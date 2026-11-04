
const {
  verifyWebhookCapturedPayment,
} = require("./webhookPaymentReconciliationServices");

const {
  confirmCapturedPaymentTransaction,
} = require("./paymentConfirmationTransactionServices");

// ==========================================
// CONFIRM WEBHOOK CAPTURED PAYMENT
// ==========================================

// Supports:
// 1. Razorpay-only payments
// 2. Wallet + Razorpay split payments
//
// Wallet-only orders do not require
// Razorpay webhook confirmation.
//
// IMPORTANT:
// The webhook signature must already
// have been authenticated by the
// webhook ingestion layer.
//
// This service must not trust the webhook
// amount without independent verification.

const confirmWebhookCapturedPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
}) => {
  // 1. Validate incoming Razorpay identifiers
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId) ||
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpayPaymentId)
  ) {
    throw new Error(
      "Invalid webhook payment identifiers"
    );
  }

  // 2. Validate the reported amount
  //
  // This is the amount reported by Razorpay.
  // It is NOT automatically trusted as the
  // expected Loomzi order payment amount.
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error(
      "Invalid webhook payment amount"
    );
  }

  // 3. Verify captured payment using
  // Razorpay's API and trusted order data.
  //
  // The reconciliation service must:
  // - Find the matching Loomzi order
  // - Validate its payment method
  // - Calculate the Razorpay contribution
  // - Compare the captured payment amount
  // - Confirm payment status is captured
  const verification =
    await verifyWebhookCapturedPayment({
      razorpayOrderId,
      razorpayPaymentId,
      amountInPaise,
    });

  // 4. Stop if verification failed
  if (
    !verification ||
    verification.verified !== true
  ) {
    return {
      confirmed: false,
      requiresReconciliation: true,
      reason:
        verification?.reason ||
        "Webhook payment verification was unsuccessful",
    };
  }

  // 5. Validate verified payment identity
  if (
    verification.razorpayOrderId !==
      razorpayOrderId ||
    verification.razorpayPaymentId !==
      razorpayPaymentId
  ) {
    throw new Error(
      "Verified Razorpay payment identity mismatch"
    );
  }

  // 6. Handle an already-paid order
  //
  // The reconciliation service must verify
  // that the existing paid order belongs
  // to this exact Razorpay payment.
  //
  // For split payments, it must also verify
  // the wallet settlement state.
  if (verification.alreadyPaid === true) {
    return {
      confirmed: true,
      alreadyPaid: true,
      orderId: verification.orderId,
    };
  }

  // 7. Confirm payment in MongoDB
  //
  // The transaction must independently
  // recheck the order, attempt and stock.
  //
  // For Wallet + Razorpay, it must also
  // settle the reserved wallet contribution
  // without deducting the balance again.
  const result =
    await confirmCapturedPaymentTransaction({
      userId: verification.userId,
      orderId: verification.orderId,
      razorpayOrderId:
        verification.razorpayOrderId,
      razorpayPaymentId:
        verification.razorpayPaymentId,
    });

  // 8. Return confirmation result
  return {
    confirmed: true,
    alreadyPaid:
      result.alreadyConfirmed === true,
    orderId: result.orderId,
    result,
  };
};

module.exports = {
  confirmWebhookCapturedPayment,
};
