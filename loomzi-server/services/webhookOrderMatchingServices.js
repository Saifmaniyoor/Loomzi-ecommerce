
const {
  findOrderByRazorpayOrderId,
} = require("./orderServices");

const matchWebhookOrder = async ({
  razorpayOrderId,
  amountInPaise,
}) => {
  // 1. Validate Razorpay order ID.
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(razorpayOrderId)
  ) {
    throw new Error("Invalid Razorpay order ID");
  }

  // 2. Validate amount.
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error("Invalid payment amount");
  }

  // 3. Find matching Loomzi order.
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

  // 4. Calculate trusted order amount.
  const expectedAmountInPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(expectedAmountInPaise) ||
    expectedAmountInPaise < 100 ||
    expectedAmountInPaise !== amountInPaise
  ) {
    return {
      matched: false,
      requiresReconciliation: true,
      message: "Payment amount does not match Loomzi order",
    };
  }

  // 5. Handle already-paid orders.
  if (order.paymentStatus === "Paid") {
    return {
      matched: true,
      alreadyPaid: true,
      requiresReconciliation: false,
      orderId: order._id,
      userId: order.user,
      razorpayPaymentId: order.razorpayPaymentId,
      expectedAmountInPaise,
    };
  }

  // 6. Check whether the order is pending.
  if (
    order.paymentStatus !== "Pending" ||
    order.orderStatus !== "Pending" ||
    order.razorpayPaymentId
  ) {
    return {
      matched: false,
      requiresReconciliation: true,
      message: "Order is not eligible for automatic confirmation",
    };
  }

  // 7. Return the matching order.
  return {
    matched: true,
    alreadyPaid: false,
    requiresReconciliation: false,
    orderId: order._id,
    userId: order.user,
    expectedAmountInPaise,
  };
};

module.exports = {
  matchWebhookOrder,
};
