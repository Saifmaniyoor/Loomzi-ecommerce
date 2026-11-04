
const mongoose = require("mongoose");

const CheckoutAttempt = require(
  "../models/CheckoutAttempt"
);

const Order = require("../models/Order");

const StockReservation = require(
  "../models/StockReservation"
);

// =====================================================
// PAYMENT METHODS THAT REQUIRE RAZORPAY
// =====================================================

const RAZORPAY_METHODS = [
  "Razorpay",
  "Wallet+Razorpay",
];

// =====================================================
// VALIDATE RAZORPAY PAYMENT ALLOCATION
// =====================================================

function getExpectedRazorpayAmount(order) {
  const totalPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid order payment amount");
  }

  if (order.paymentMethod === "Razorpay") {
    // Existing orders may not have a breakdown.
    if (!order.paymentBreakdown) {
      return totalPaise;
    }

    const breakdown = order.paymentBreakdown;

    if (
      breakdown.totalPaise !== totalPaise ||
      breakdown.walletPaise !== 0 ||
      breakdown.razorpayPaise !== totalPaise
    ) {
      throw new Error(
        "Razorpay payment breakdown mismatch"
      );
    }

    return totalPaise;
  }

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
      walletPaise + razorpayPaise !== totalPaise
    ) {
      throw new Error(
        "Invalid split payment allocation"
      );
    }

    if (walletStatus !== "Reserved") {
      throw new Error(
        "Wallet funds are not reserved for this checkout"
      );
    }

    return razorpayPaise;
  }

  throw new Error(
    "This payment method does not require Razorpay"
  );
}

// =====================================================
// CLAIM PAYMENT CREATION TRANSACTION
// =====================================================

// Internal transaction.
//
// Only one checkout request can change its
// status from Processing to Creating Payment.
//
// IMPORTANT:
// This function does NOT call Razorpay.
// It only claims permission to create
// a Razorpay payment order.

const claimPaymentCreationTransaction = async ({
  attemptId,
  userId,
  orderId,
}) => {
  // 1. Validate MongoDB identifiers
  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid checkout identifiers");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 2. Verify pending Loomzi order
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        paymentMethod: {
          $in: RAZORPAY_METHODS,
        },
        paymentStatus: "Pending",
        orderStatus: "Pending",
        razorpayOrderId: null,
        razorpayPaymentId: null,
      }).session(session);

      if (!order) {
        throw new Error(
          "Order is not available for Razorpay payment"
        );
      }

      // 3. Determine the correct Razorpay amount.
      // Razorpay-only: full order total.
      // Split payment: Razorpay contribution only.
      const expectedAmountInPaise =
        getExpectedRazorpayAmount(order);

      // 4. Verify stock reservation
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

      // 5. Atomically claim payment creation.
      // Match the payment method and amount
      // against the pending order.
      const attempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attemptId,
            user: userId,
            order: orderId,
            paymentMethod: order.paymentMethod,
            status: "Processing",
            razorpayOrderId: null,
            recoveryRazorpayOrderId: null,
            amountInPaise: expectedAmountInPaise,
            currency: "INR",
          },
          {
            $set: {
              status: "Creating Payment",
              errorMessage: null,
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

      if (!attempt) {
        throw new Error(
          "Checkout attempt cannot be claimed"
        );
      }

      // 6. Validate the attempt breakdown
      // after claiming it.
      //
      // Any error here rolls back the
      // entire MongoDB transaction.
      if (order.paymentMethod === "Wallet+Razorpay") {
        const attemptBreakdown =
          attempt.paymentBreakdown;

        const orderBreakdown =
          order.paymentBreakdown;

        if (
          !attemptBreakdown ||
          attemptBreakdown.totalPaise !==
            orderBreakdown.totalPaise ||
          attemptBreakdown.walletPaise !==
            orderBreakdown.walletPaise ||
          attemptBreakdown.razorpayPaise !==
            orderBreakdown.razorpayPaise
        ) {
          throw new Error(
            "Checkout attempt payment breakdown mismatch"
          );
        }
      }

      // 7. Return the claimed payment details
      result = {
        attemptId: attempt._id,
        orderId: order._id,
        paymentMethod: order.paymentMethod,
        amountInPaise: attempt.amountInPaise,
        currency: attempt.currency,
        status: attempt.status,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  claimPaymentCreationTransaction,
};
