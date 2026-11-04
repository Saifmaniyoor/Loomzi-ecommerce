
const mongoose = require("mongoose");

const Order = require("../models/Order");

const CheckoutAttempt = require(
  "../models/CheckoutAttempt"
);

const StockReservation = require(
  "../models/StockReservation"
);

// =====================================================
// SUPPORTED RAZORPAY PAYMENT METHODS
// =====================================================

const RAZORPAY_METHODS = [
  "Razorpay",
  "Wallet+Razorpay",
];

// =====================================================
// VALIDATE ORDER PAYMENT ALLOCATION
// =====================================================

function getExpectedRazorpayAmount(order) {
  const totalPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid Loomzi order total");
  }

  // Legacy Razorpay orders may not have
  // a payment breakdown.
  if (order.paymentMethod === "Razorpay") {
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
      throw new Error(
        "Razorpay payment breakdown mismatch"
      );
    }

    return totalPaise;
  }

  // Split payment must have a valid
  // reserved wallet contribution.
  if (order.paymentMethod === "Wallet+Razorpay") {
    const breakdown = order.paymentBreakdown;

    if (!breakdown) {
      throw new Error(
        "Split payment breakdown is missing"
      );
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
      walletStatus !== "Reserved"
    ) {
      throw new Error(
        "Invalid or unreserved split payment allocation"
      );
    }

    return razorpayPaise;
  }

  throw new Error(
    "Order payment method does not require Razorpay"
  );
}

// =====================================================
// VALIDATE CHECKOUT ATTEMPT ALLOCATION
// =====================================================

function validateAttemptAllocation(attempt, order) {
  if (attempt.paymentMethod !== order.paymentMethod) {
    throw new Error(
      "Checkout attempt payment method mismatch"
    );
  }

  const expectedAmount =
    getExpectedRazorpayAmount(order);

  if (attempt.amountInPaise !== expectedAmount) {
    throw new Error(
      "Checkout attempt Razorpay amount mismatch"
    );
  }

  // Older Razorpay attempts may not
  // contain paymentBreakdown.
  if (
    order.paymentMethod === "Razorpay" &&
    !attempt.paymentBreakdown
  ) {
    return expectedAmount;
  }

  const attemptBreakdown = attempt.paymentBreakdown;
  const orderBreakdown = order.paymentBreakdown;

  if (!attemptBreakdown || !orderBreakdown) {
    throw new Error(
      "Checkout payment breakdown is missing"
    );
  }

  if (
    attemptBreakdown.totalPaise !==
      orderBreakdown.totalPaise ||
    attemptBreakdown.walletPaise !==
      orderBreakdown.walletPaise ||
    attemptBreakdown.razorpayPaise !==
      orderBreakdown.razorpayPaise
  ) {
    throw new Error(
      "Checkout and order payment allocations do not match"
    );
  }

  return expectedAmount;
}

// =====================================================
// LINK RAZORPAY ORDER TRANSACTION
// =====================================================

// Razorpay order creation has already happened.
// This function only updates MongoDB.
//
// Both database updates must succeed together.
// Otherwise, MongoDB rolls back the transaction.

const linkRazorpayOrderTransaction = async ({
  attemptId,
  userId,
  orderId,
  razorpayOrderId,
  amountInPaise,
}) => {
  // 1. Validate MongoDB identifiers
  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid checkout identifiers");
  }

  // 2. Validate Razorpay order ID
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId)
  ) {
    throw new Error("Invalid Razorpay order ID");
  }

  // 3. Validate Razorpay amount
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error("Invalid Razorpay payment amount");
  }

  const session = await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(async () => {
      // 4. Verify checkout attempt
      const attempt = await CheckoutAttempt.findOne({
        _id: attemptId,
        user: userId,
        order: orderId,
        paymentMethod: {
          $in: RAZORPAY_METHODS,
        },
        status: "Creating Payment",
        razorpayOrderId: null,
        amountInPaise,
        currency: "INR",
      }).session(session);

      if (!attempt) {
        throw new Error(
          "Checkout attempt is not available for payment linking"
        );
      }

      // 5. Check recovery Razorpay ID
      if (
        attempt.recoveryRazorpayOrderId &&
        attempt.recoveryRazorpayOrderId !==
          razorpayOrderId
      ) {
        throw new Error(
          "Conflicting Razorpay order ID requires reconciliation"
        );
      }

      // 6. Verify pending Loomzi order
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        paymentMethod: attempt.paymentMethod,
        paymentStatus: "Pending",
        orderStatus: "Pending",
        razorpayOrderId: null,
        razorpayPaymentId: null,
      }).session(session);

      if (!order) {
        throw new Error(
          "Pending Loomzi order not found"
        );
      }

      // 7. Validate amount and allocation
      const expectedAmountInPaise =
        validateAttemptAllocation(attempt, order);

      if (expectedAmountInPaise !== amountInPaise) {
        throw new Error(
          "Razorpay amount does not match order allocation"
        );
      }

      // 8. Verify active stock reservation
      const reservation =
        await StockReservation.findOne({
          order: orderId,
          user: userId,
          status: "Active",
          expiresAt: {
            $gt: new Date(),
          },
        }).session(session);

      if (!reservation) {
        throw new Error(
          "Stock reservation is missing or expired"
        );
      }

      // 9. Link Razorpay order ID to Loomzi order
      const updatedOrder =
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            user: userId,
            paymentMethod: order.paymentMethod,
            paymentStatus: "Pending",
            orderStatus: "Pending",
            razorpayOrderId: null,
            razorpayPaymentId: null,
          },
          {
            $set: {
              razorpayOrderId,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

      if (!updatedOrder) {
        throw new Error(
          "Could not attach Razorpay order to Loomzi order"
        );
      }

      // 10. Link Razorpay order ID to checkout attempt
      const updatedAttempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attemptId,
            user: userId,
            order: orderId,
            paymentMethod: order.paymentMethod,
            status: "Creating Payment",
            razorpayOrderId: null,
            amountInPaise,
            currency: "INR",
            $or: [
              {
                recoveryRazorpayOrderId: null,
              },
              {
                recoveryRazorpayOrderId:
                  razorpayOrderId,
              },
            ],
          },
          {
            $set: {
              razorpayOrderId,
              status: "Ready",
              errorMessage: null,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

      if (!updatedAttempt) {
        throw new Error(
          "Could not attach Razorpay order to checkout attempt"
        );
      }

      // 11. Return linked payment details
      result = {
        orderId: updatedOrder._id,
        paymentMethod: order.paymentMethod,
        razorpayOrderId,
        amountInPaise,
        currency: "INR",
        status: updatedAttempt.status,
        reservationExpiresAt:
          reservation.expiresAt,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  linkRazorpayOrderTransaction,
};
