
const mongoose = require("mongoose");

const checkoutAttemptServices = require(
  "./checkoutAttemptServices"
);
const orderServices = require("./orderServices");
const stockReservationServices = require(
  "./stockReservationServices"
);
const paymentServices = require("./paymentServices");
const {
  inspectRazorpayPaymentActivity,
} = require("./paymentActivityServices");

// Read-only inspection. This does not authorize a payment retry.
const inspectPaymentRecovery = async ({
  attemptId,
  userId,
  orderId,
}) => {
  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid recovery identifiers");
  }

  const reconciliationRequired = (reason, extra = {}) => ({
    recoverable: false,
    requiresReconciliation: true,
    safeToResume: false,
    reason,
    ...extra,
  });

  const attempt =
    await checkoutAttemptServices.findAttemptById(attemptId);

  if (
    !attempt ||
    String(attempt.user) !== String(userId) ||
    String(attempt.order) !== String(orderId)
  ) {
    throw new Error("Checkout attempt not found");
  }

  const order = await orderServices.findOrderByIdAndUser({
    orderId,
    userId,
  });

  if (!order) {
    throw new Error("Loomzi order not found");
  }

  const totalPaise = Math.round(order.totalAmount * 100);
  const expectedAmountInPaise =
    order.paymentMethod === "Wallet+Razorpay"
      ? order.paymentBreakdown?.razorpayPaise
      : totalPaise;

  if (
    !Number.isSafeInteger(expectedAmountInPaise) ||
    expectedAmountInPaise < 100 ||
    attempt.amountInPaise !== expectedAmountInPaise ||
    attempt.currency !== "INR"
  ) {
    return reconciliationRequired(
      "Checkout amount or currency does not match the Loomzi order"
    );
  }

  const reservation =
    await stockReservationServices.findReservationByOrderId(
      orderId
    );

  if (
    !reservation ||
    String(reservation.user) !== String(userId) ||
    String(reservation.order) !== String(orderId)
  ) {
    return reconciliationRequired(
      "Matching stock reservation not found"
    );
  }

  const knownIds = [
    attempt.razorpayOrderId,
    attempt.recoveryRazorpayOrderId,
    order.razorpayOrderId,
  ].filter(Boolean);

  if (new Set(knownIds).size > 1) {
    return reconciliationRequired(
      "Conflicting Razorpay order IDs were found"
    );
  }

  const razorpayOrderId = knownIds[0];

  if (!razorpayOrderId) {
    return reconciliationRequired(
      "Razorpay order ID is unknown. Provider reconciliation is required."
    );
  }

  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId)
  ) {
    return reconciliationRequired(
      "Invalid stored Razorpay order ID"
    );
  }

  let razorpayOrder;

  try {
    razorpayOrder =
      await paymentServices.fetchRazorpayOrder(
        razorpayOrderId
      );
  } catch (error) {
    console.error(
      "Razorpay order recovery lookup failed:",
      error.message
    );

    return reconciliationRequired(
      "Razorpay order could not be verified. Retry reconciliation later."
    );
  }

  if (
    !razorpayOrder ||
    razorpayOrder.id !== razorpayOrderId
  ) {
    return reconciliationRequired(
      "Unexpected Razorpay order response"
    );
  }

  if (
    razorpayOrder.amount !== expectedAmountInPaise ||
    razorpayOrder.currency !== "INR" ||
    razorpayOrder.receipt !== String(orderId)
  ) {
    return reconciliationRequired(
      "Razorpay order details do not match Loomzi"
    );
  }

  let paymentActivity;

  try {
    paymentActivity =
      await inspectRazorpayPaymentActivity({
        razorpayOrderId,
        amountInPaise: expectedAmountInPaise,
      });
  } catch (error) {
    console.error(
      "Razorpay payment activity lookup failed:",
      error.message
    );

    return reconciliationRequired(
      "Payment activity could not be verified. Reconciliation required."
    );
  }

  if (
    !paymentActivity ||
    paymentActivity.requiresReconciliation ||
    paymentActivity.safeToResume !== false
  ) {
    return reconciliationRequired(
      paymentActivity?.reason ||
        "Razorpay payment activity requires reconciliation",
      {
        paymentCount:
          paymentActivity?.paymentCount ?? null,
        paymentStatus:
          paymentActivity?.paymentStatus ?? null,
      }
    );
  }

  if (
    order.paymentStatus !== "Pending" ||
    order.orderStatus !== "Pending"
  ) {
    return reconciliationRequired(
      "Loomzi order is no longer pending",
      {
        paymentCount:
          paymentActivity.paymentCount ?? null,
      }
    );
  }

  if (reservation.status !== "Active") {
    return reconciliationRequired(
      "Stock reservation is no longer active",
      {
        paymentCount:
          paymentActivity.paymentCount ?? null,
      }
    );
  }

  const expiresAt = new Date(reservation.expiresAt);

  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    return reconciliationRequired(
      "Stock reservation has expired",
      {
        paymentCount:
          paymentActivity.paymentCount ?? null,
      }
    );
  }

  if (
    razorpayOrder.status !== "created" &&
    !(
      razorpayOrder.status === "attempted" &&
      paymentActivity.paymentStatus === "failed"
    )
  ) {
    return reconciliationRequired(
      "Razorpay order status requires reconciliation",
      {
        razorpayOrderStatus:
          razorpayOrder.status ?? "unknown",
        paymentCount:
          paymentActivity.paymentCount ?? null,
      }
    );
  }

  if (
    ![
      "Creating Payment",
      "Ready",
      "Recovery Required",
    ].includes(attempt.status)
  ) {
    return reconciliationRequired(
      "Checkout attempt status requires reconciliation"
    );
  }

  return {
    recoverable: true,
    requiresReconciliation: false,
    safeToResume: false,
    orderId: order._id,
    razorpayOrderId,
    amountInPaise: expectedAmountInPaise,
    currency: "INR",
    reservationExpiresAt: reservation.expiresAt,
    paymentCount: paymentActivity.paymentCount,
    paymentStatus:
      paymentActivity.paymentStatus ??
      (paymentActivity.paymentCount === 0
        ? "none"
        : "unknown"),
    message:
      "Razorpay order and local records were inspected. No payment resumption or retry is authorized.",
  };
};

module.exports = {
  inspectPaymentRecovery,
};
