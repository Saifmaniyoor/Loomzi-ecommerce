
const {
  fetchRazorpayPayment,
} = require("./paymentServices");

const {
  matchWebhookOrder,
} = require("./webhookOrderMatchingServices");

// Read-only verification and order matching.
// Does NOT update MongoDB.

const verifyWebhookCapturedPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  amountInPaise,
}) => {
  // ==========================================
  // 1. VALIDATE PAYMENT DETAILS
  // ==========================================

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

  // ==========================================
  // 2. VERIFY PAYMENT WITH RAZORPAY
  // ==========================================

  const payment = await fetchRazorpayPayment(
    razorpayPaymentId
  );

  if (
    !payment ||
    payment.id !== razorpayPaymentId ||
    payment.order_id !== razorpayOrderId ||
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

  // ==========================================
  // 3. MATCH LOOMZI ORDER
  // ==========================================

  const matching = await matchWebhookOrder({
    razorpayOrderId,
    amountInPaise,
  });

  if (!matching.matched) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        matching.message ||
        "Matching Loomzi order not found",
    };
  }

  // ==========================================
  // 4. CHECK ALREADY-PAID ORDERS
  // ==========================================

  if (matching.alreadyPaid) {
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

  // ==========================================
  // 5. RETURN VERIFIED PAYMENT DETAILS
  // ==========================================

  return {
    verified: true,
    requiresReconciliation: false,
    alreadyPaid: matching.alreadyPaid,
    userId: matching.userId,
    orderId: matching.orderId,
    razorpayOrderId,
    razorpayPaymentId,
    amountInPaise,
  };
};

module.exports = {
  verifyWebhookCapturedPayment,
};
