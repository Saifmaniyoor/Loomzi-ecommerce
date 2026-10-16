
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

// Internal, read-only recovery inspection.
//
// IMPORTANT:
// This function does not authorize payment retry,
// payment resumption, stock release, or order cancellation.
//
// Provider results can change after inspection.
// Any future action requires additional safeguards.
const inspectPaymentRecovery = async ({
  attemptId,
  userId,
  orderId,
}) => {
  // 1. Validate identifiers
  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid recovery identifiers");
  }

  const reconciliationRequired = (
    reason,
    extra = {}
  ) => ({
    recoverable: false,
    requiresReconciliation: true,
    safeToResume: false,
    reason,
    ...extra,
  });

  // 2. Find checkout attempt
  const attempt =
    await checkoutAttemptServices.findAttemptById(
      attemptId
    );

  if (
    !attempt ||
    String(attempt.user) !== String(userId) ||
    String(attempt.order) !== String(orderId)
  ) {
    throw new Error("Checkout attempt not found");
  }

  // 3. Find customer's Loomzi order
  const order =
    await orderServices.findOrderByIdAndUser({
      orderId,
      userId,
    });

  if (!order) {
    throw new Error("Loomzi order not found");
  }

  // 4. Validate expected payment amount
  const expectedAmountInPaise = Math.round(
    order.totalAmount * 100
  );

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

  // 5. Find stock reservation
  const reservation =
    await stockReservationServices
      .findReservationByOrderId(orderId);

  if (
    !reservation ||
    String(reservation.user) !== String(userId) ||
    String(reservation.order) !== String(orderId)
  ) {
    return reconciliationRequired(
      "Matching stock reservation not found"
    );
  }

  // 6. Check for conflicting Razorpay order IDs
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

  // 7. Determine existing Razorpay order ID
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

  // 8. Retrieve Razorpay order
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

  // 9. Verify Razorpay order details
  if (
    razorpayOrder.amount !== expectedAmountInPaise ||
    razorpayOrder.currency !== "INR" ||
    razorpayOrder.receipt !== String(orderId)
  ) {
    return reconciliationRequired(
      "Razorpay order details do not match Loomzi"
    );
  }

  // 10. Inspect Razorpay payment activity
  //
  // Inspect payment activity before considering
  // any local reservation or order state.
  // A captured payment must never be ignored
  // merely because a reservation expired.
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

  // 11. Verify local order state
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

  // 12. Verify reservation state
  if (reservation.status !== "Active") {
    return reconciliationRequired(
      "Stock reservation is no longer active",
      {
        paymentCount:
          paymentActivity.paymentCount ?? null,
      }
    );
  }

  // 13. Check reservation expiry
  const expiresAt = new Date(
    reservation.expiresAt
  );

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

  // 14. Verify Razorpay order status
  if (razorpayOrder.status !== "created") {
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

  // 15. Validate checkout attempt state
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

  // 16. Return read-only inspection result
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
    message:
      "Razorpay order and local records were inspected. No payment resumption or retry is authorized.",
  };
};

module.exports = {
  inspectPaymentRecovery,
};
