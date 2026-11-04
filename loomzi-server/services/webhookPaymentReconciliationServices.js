
const {
  fetchRazorpayPayment,
} = require("./paymentServices");

const {
  matchWebhookOrder,
} = require("./webhookOrderMatchingServices");

// ==========================================
// VERIFY WEBHOOK CAPTURED PAYMENT
// ==========================================

// Read-only verification and order matching.
//
// Supports:
// - Razorpay-only
// - Wallet + Razorpay
//
// Does NOT modify MongoDB.
//
// IMPORTANT:
// The caller must first authenticate the
// webhook signature.
//
// The reported webhook amount is compared
// against Razorpay's API response here.
//
// matchWebhookOrder() must separately
// compare it with the trusted Loomzi
// order's Razorpay contribution.

const verifyWebhookCapturedPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
}) => {
  // 1. Validate payment details
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId) ||
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(razorpayPaymentId) ||
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error(
      "Invalid webhook payment verification details"
    );
  }

  // 2. Fetch payment directly from Razorpay.
  //
  // Provider/network errors must propagate.
  // An unavailable response is not proof
  // that payment failed.
  const payment = await fetchRazorpayPayment(
    razorpayPaymentId
  );

  // 3. Verify payment identity and capture
  if (
    !payment ||
    payment.id !== razorpayPaymentId ||
    payment.order_id !== razorpayOrderId ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount !== amountInPaise ||
    payment.currency !== "INR" ||
    payment.status !== "captured" ||
    payment.captured !== true
  ) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason: "Razorpay payment verification failed",
    };
  }

  // 4. Match payment to the Loomzi order.
  //
  // This service must check:
  //
  // Razorpay-only:
  //   expected = full order total
  //
  // Wallet + Razorpay:
  //   expected = paymentBreakdown.razorpayPaise
  //
  // Wallet-only and COD must be rejected.
  const matching = await matchWebhookOrder({
    razorpayOrderId,
    amountInPaise: payment.amount,
  });

  if (!matching || matching.matched !== true) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        matching?.message ||
        "Matching Loomzi order not found",
    };
  }

  // 5. Validate matched order identifiers
  if (
    !matching.userId ||
    !matching.orderId
  ) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason: "Matching Loomzi order identity is missing",
    };
  }

  // 6. Check already-paid orders.
  //
  // A duplicate webhook is acceptable only
  // when the existing order was paid using
  // this exact Razorpay payment ID.
  if (matching.alreadyPaid === true) {
    if (
      matching.razorpayPaymentId !==
      razorpayPaymentId
    ) {
      return {
        verified: false,
        requiresReconciliation: true,
        reason:
          "Order was paid using a different Razorpay payment",
      };
    }
  }

  // 7. Return verified payment details
  return {
    verified: true,
    requiresReconciliation: false,
    alreadyPaid: matching.alreadyPaid === true,
    userId: matching.userId,
    orderId: matching.orderId,
    razorpayOrderId,
    razorpayPaymentId,
    amountInPaise: payment.amount,
    currency: payment.currency,
    paymentStatus: payment.status,
  };
};

module.exports = {
  verifyWebhookCapturedPayment,
};
