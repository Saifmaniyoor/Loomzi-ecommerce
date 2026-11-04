
const mongoose = require("mongoose");

const orderServices = require("./orderServices");

const {
  verifyCapturedPayment,
} = require("./paymentVerificationServices");

const {
  confirmCapturedPaymentTransaction,
} = require("./paymentConfirmationTransactionServices");

// Internal payment confirmation service.
//
// IMPORTANT:
// This service verifies the Razorpay checkout
// signature and fetches the captured payment
// directly from Razorpay before updating MongoDB.
//
// Webhook events require a separate verification
// process using the Razorpay webhook secret.
const confirmRazorpayPayment = async ({
  userId,
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  // 1. Validate MongoDB identifiers
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid order details");
  }

  // 2. Validate Razorpay order ID
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId)
  ) {
    throw new Error("Invalid Razorpay order ID");
  }

  // 3. Validate Razorpay payment ID
  if (
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpayPaymentId)
  ) {
    throw new Error("Invalid Razorpay payment ID");
  }

  // 4. Validate Razorpay signature
  if (
    typeof razorpaySignature !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(razorpaySignature)
  ) {
    return {
      success: false,
      reason: "Invalid Razorpay payment signature",
    };
  }

  // 5. Load order using authenticated customer ID
  const order =
    await orderServices.findOrderByIdAndUser({
      orderId,
      userId,
    });

  if (!order) {
    throw new Error("Loomzi order not found");
  }

  // 6. Verify stored Razorpay order ID
  if (
    !order.razorpayOrderId ||
    order.razorpayOrderId !== razorpayOrderId
  ) {
    throw new Error(
      "Razorpay order ID does not match Loomzi order"
    );
  }

  // 7. Calculate the amount Razorpay actually collected.
  // For split payments the wallet contribution was reserved separately.
  const totalPaise = Math.round(order.totalAmount * 100);
  const breakdown = order.paymentBreakdown;
  let expectedAmountInPaise;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < 100) {
    throw new Error("Invalid order payment amount");
  }

  if (order.paymentMethod === "Wallet+Razorpay") {
    if (
      !breakdown ||
      breakdown.totalPaise !== totalPaise ||
      !Number.isSafeInteger(breakdown.walletPaise) ||
      !Number.isSafeInteger(breakdown.razorpayPaise) ||
      breakdown.walletPaise <= 0 ||
      breakdown.razorpayPaise < 100 ||
      breakdown.walletPaise + breakdown.razorpayPaise !== totalPaise ||
      !["Reserved", "Settled"].includes(breakdown.walletStatus)
    ) {
      throw new Error("Invalid split payment breakdown");
    }
    expectedAmountInPaise = breakdown.razorpayPaise;
  } else if (order.paymentMethod === "Razorpay") {
    if (
      breakdown &&
      (breakdown.totalPaise !== totalPaise ||
        breakdown.walletPaise !== 0 ||
        breakdown.razorpayPaise !== totalPaise)
    ) {
      throw new Error("Invalid Razorpay payment breakdown");
    }
    expectedAmountInPaise = totalPaise;
  } else {
    throw new Error("Order does not require Razorpay confirmation");
  }

  // 8. Verify signature and captured payment
  //
  // Razorpay API/network errors propagate.
  // They must not be treated as payment failure.
  const verification = await verifyCapturedPayment({
    razorpayOrderId: order.razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedAmountInPaise,
  });

  // 9. Handle unsuccessful verification
  if (!verification.verified) {
    return {
      success: false,
      reason:
        verification.reason ||
        "Razorpay payment verification failed",
      paymentStatus:
        verification.paymentStatus || null,
      requiresReconciliation:
        verification.requiresReconciliation === true,
    };
  }

  // 10. Confirm captured payment in MongoDB
  //
  // This transaction must atomically update:
  // - Order payment status
  // - Stock reservation status
  // - Checkout attempt status
  //
  // It must also handle duplicate confirmations
  // for the same Razorpay payment ID.
  const result =
    await confirmCapturedPaymentTransaction({
      userId,
      orderId,
      razorpayOrderId:
        verification.razorpayOrderId,
      razorpayPaymentId:
        verification.razorpayPaymentId,
    });

  // 11. Return confirmed payment result
  return {
    success: true,
    ...result,
  };
};

module.exports = {
  confirmRazorpayPayment,
};
