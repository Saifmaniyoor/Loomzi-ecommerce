
const {
  findOrderByRazorpayOrderId,
} = require("./orderServices");

// ==========================================
// GET EXPECTED RAZORPAY AMOUNT
// ==========================================

const getExpectedRazorpayAmount = (order) => {
  const totalPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    return null;
  }

  // Razorpay-only payment
  if (order.paymentMethod === "Razorpay") {
    // Support legacy Razorpay orders
    // without a payment breakdown.
    if (!order.paymentBreakdown) {
      return totalPaise;
    }

    const breakdown = order.paymentBreakdown;

    if (
      breakdown.totalPaise !== totalPaise ||
      breakdown.walletPaise !== 0 ||
      breakdown.razorpayPaise !== totalPaise ||
      breakdown.walletStatus !== "Not Used"
    ) {
      return null;
    }

    return totalPaise;
  }

  // Wallet + Razorpay split payment
  if (order.paymentMethod === "Wallet+Razorpay") {
    const breakdown = order.paymentBreakdown;

    if (!breakdown) {
      return null;
    }

    const {
      totalPaise: breakdownTotal,
      walletPaise,
      razorpayPaise,
      walletStatus,
    } = breakdown;

    if (
      !Number.isSafeInteger(breakdownTotal) ||
      !Number.isSafeInteger(walletPaise) ||
      !Number.isSafeInteger(razorpayPaise) ||
      breakdownTotal !== totalPaise ||
      walletPaise <= 0 ||
      razorpayPaise < 100 ||
      walletPaise + razorpayPaise !== totalPaise ||
      !["Reserved", "Settled"].includes(
        walletStatus
      )
    ) {
      return null;
    }

    return razorpayPaise;
  }

  // Wallet-only and COD do not require
  // Razorpay payment matching.
  return null;
};

// ==========================================
// MATCH WEBHOOK ORDER
// ==========================================

// Read-only service.
//
// Matches a Razorpay captured payment
// with a trusted Loomzi order.
//
// Supports:
// - Razorpay
// - Wallet + Razorpay
//
// Does not modify MongoDB.

const matchWebhookOrder = async ({
  razorpayOrderId,
  amountInPaise,
}) => {
  // 1. Validate Razorpay order ID
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId)
  ) {
    throw new Error("Invalid Razorpay order ID");
  }

  // 2. Validate captured amount
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error("Invalid payment amount");
  }

  // 3. Find matching Loomzi order
  const order = await findOrderByRazorpayOrderId(
    razorpayOrderId
  );

  if (!order) {
    return {
      matched: false,
      requiresReconciliation: true,
      message: "Matching Loomzi order not found",
    };
  }

  // 4. Reject unsupported payment methods
  if (
    !["Razorpay", "Wallet+Razorpay"].includes(
      order.paymentMethod
    )
  ) {
    return {
      matched: false,
      requiresReconciliation: true,
      message:
        "Order payment method does not support Razorpay confirmation",
    };
  }

  // 5. Calculate expected Razorpay amount
  const expectedAmountInPaise =
    getExpectedRazorpayAmount(order);

  if (
    expectedAmountInPaise === null ||
    expectedAmountInPaise !== amountInPaise
  ) {
    return {
      matched: false,
      requiresReconciliation: true,
      message:
        "Razorpay payment amount does not match Loomzi order allocation",
    };
  }

  // 6. Handle already-paid orders
  if (order.paymentStatus === "Paid") {
    // For split payments, wallet settlement
    // must already be completed.
    if (
      order.paymentMethod === "Wallet+Razorpay" &&
      order.paymentBreakdown.walletStatus !==
        "Settled"
    ) {
      return {
        matched: false,
        requiresReconciliation: true,
        message:
          "Paid split order requires wallet reconciliation",
      };
    }

    if (!order.razorpayPaymentId) {
      return {
        matched: false,
        requiresReconciliation: true,
        message:
          "Paid order is missing Razorpay payment ID",
      };
    }

    return {
      matched: true,
      alreadyPaid: true,
      requiresReconciliation: false,
      orderId: order._id,
      userId: order.user,
      paymentMethod: order.paymentMethod,
      razorpayPaymentId:
        order.razorpayPaymentId,
      expectedAmountInPaise,
    };
  }

  // 7. Check pending order eligibility
  if (
    order.paymentStatus !== "Pending" ||
    order.orderStatus !== "Pending" ||
    order.razorpayPaymentId
  ) {
    return {
      matched: false,
      requiresReconciliation: true,
      message:
        "Order is not eligible for automatic confirmation",
    };
  }

  // 8. Check wallet reservation state
  if (
    order.paymentMethod === "Wallet+Razorpay" &&
    order.paymentBreakdown.walletStatus !==
      "Reserved"
  ) {
    return {
      matched: false,
      requiresReconciliation: true,
      message:
        "Split payment wallet reservation is not available",
    };
  }

  // 9. Return matched pending order
  return {
    matched: true,
    alreadyPaid: false,
    requiresReconciliation: false,
    orderId: order._id,
    userId: order.user,
    paymentMethod: order.paymentMethod,
    expectedAmountInPaise,
  };
};

module.exports = {
  matchWebhookOrder,
};
