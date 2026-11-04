
const paymentServices = require("./paymentServices");

const {
  verifyRazorpaySignature,
} = require("../utils/razorpaySignature");

// ==========================================
// RAZORPAY PAYMENT VERIFICATION
// ==========================================

// Verify a captured Razorpay payment
// without modifying MongoDB.
//
// Supports:
// 1. Razorpay-only payments
// 2. Wallet + Razorpay split payments
//
// Wallet-only payments must not use
// this function.
//
// IMPORTANT:
// This verifies a customer checkout callback.
// Webhook verification requires a separate
// Razorpay webhook signature verification flow.

const verifyCapturedPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  expectedAmountInPaise,
}) => {
  // 1. Validate Razorpay order ID
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId)
  ) {
    throw new Error("Invalid Razorpay order ID");
  }

  // 2. Validate Razorpay payment ID
  if (
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpayPaymentId)
  ) {
    throw new Error("Invalid Razorpay payment ID");
  }

  // 3. Validate signature format
  if (
    typeof razorpaySignature !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(razorpaySignature)
  ) {
    return {
      verified: false,
      reason: "Invalid Razorpay signature format",
    };
  }

  // 4. Validate expected Razorpay amount
  //
  // Razorpay-only:
  //   Full order amount.
  //
  // Wallet + Razorpay:
  //   Remaining Razorpay contribution only.
  //
  // The caller must obtain this amount
  // from trusted backend order records.
  if (
    !Number.isSafeInteger(expectedAmountInPaise) ||
    expectedAmountInPaise < 100
  ) {
    throw new Error(
      "Invalid expected Razorpay payment amount"
    );
  }

  // 5. Verify checkout signature
  const signatureValid = verifyRazorpaySignature({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  if (!signatureValid) {
    return {
      verified: false,
      reason: "Invalid Razorpay payment signature",
    };
  }

  // 6. Fetch payment directly from Razorpay
  //
  // Do not trust payment status or amount
  // sent by the frontend.
  //
  // Network/API errors must propagate,
  // because an unavailable provider response
  // does not mean the payment failed.
  const payment =
    await paymentServices.fetchRazorpayPayment(
      razorpayPaymentId
    );

  // 7. Validate Razorpay response
  if (
    !payment ||
    typeof payment !== "object" ||
    typeof payment.id !== "string"
  ) {
    throw new Error(
      "Unexpected Razorpay payment response. Reconciliation required."
    );
  }

  // 8. Verify payment identity
  if (
    payment.id !== razorpayPaymentId ||
    payment.order_id !== razorpayOrderId
  ) {
    return {
      verified: false,
      reason: "Razorpay payment identity mismatch",
    };
  }

  // 9. Verify exact amount and currency
  if (
    !Number.isSafeInteger(payment.amount) ||
    payment.amount !== expectedAmountInPaise ||
    payment.currency !== "INR"
  ) {
    return {
      verified: false,
      reason:
        "Razorpay payment amount or currency mismatch",
    };
  }

  // 10. Verify captured payment status
  if (
    payment.status !== "captured" ||
    payment.captured !== true
  ) {
    return {
      verified: false,
      reason: "Payment is not confirmed as captured",
      paymentStatus:
        payment.status || "unknown",
      requiresReconciliation: true,
    };
  }

  // 11. Verification successful
  return {
    verified: true,
    razorpayOrderId,
    razorpayPaymentId,
    amountInPaise: payment.amount,
    currency: payment.currency,
    paymentStatus: payment.status,
  };
};

module.exports = {
  verifyCapturedPayment,
};
