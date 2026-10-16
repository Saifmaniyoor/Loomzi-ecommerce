
const paymentServices = require("./paymentServices");

const {
  verifyRazorpaySignature,
} = require("../utils/razorpaySignature");

// Verify Razorpay payment without modifying MongoDB.
//
// IMPORTANT:
// This function verifies a customer checkout callback.
// Webhook-based verification requires a separate
// webhook signature verification process.
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

  // 4. Validate expected amount
  if (
    !Number.isSafeInteger(expectedAmountInPaise) ||
    expectedAmountInPaise < 100
  ) {
    throw new Error("Invalid expected payment amount");
  }

  // 5. Verify Razorpay checkout signature
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
  // Network or Razorpay API errors are allowed
  // to propagate. Do not treat an unavailable
  // provider response as a failed payment.
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

  // 9. Verify amount and currency
  if (
    payment.amount !== expectedAmountInPaise ||
    payment.currency !== "INR"
  ) {
    return {
      verified: false,
      reason: "Razorpay payment amount or currency mismatch",
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
      paymentStatus: payment.status || "unknown",
      requiresReconciliation: true,
    };
  }

  // 11. Payment verification successful
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
