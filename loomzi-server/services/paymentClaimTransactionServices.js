
const mongoose = require("mongoose");

const CheckoutAttempt = require(
  "../models/CheckoutAttempt"
);

const Order = require("../models/Order");

const StockReservation = require(
  "../models/StockReservation"
);

// Internal transaction.
//
// Only one checkout request should be able
// to change its status from Processing
// to Creating Payment.
//
// IMPORTANT:
// This function does not call Razorpay.
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
        paymentStatus: "Pending",
        orderStatus: "Pending",
        razorpayOrderId: null,
        razorpayPaymentId: null,
      }).session(session);

      if (!order) {
        throw new Error(
          "Order is not available for payment"
        );
      }

      // 3. Calculate expected payment amount
      const expectedAmountInPaise = Math.round(
        order.totalAmount * 100
      );

      if (
        !Number.isSafeInteger(expectedAmountInPaise) ||
        expectedAmountInPaise < 100
      ) {
        throw new Error(
          "Invalid order payment amount"
        );
      }

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

      // 5. Atomically claim payment creation
      const attempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attemptId,
            user: userId,
            order: orderId,
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

      // 6. Return the claimed payment details
      result = {
        attemptId: attempt._id,
        orderId: order._id,
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
