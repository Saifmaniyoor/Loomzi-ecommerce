
const mongoose = require("mongoose");

const Order = require("../models/Order");

const CheckoutAttempt = require(
  "../models/CheckoutAttempt"
);

const StockReservation = require(
  "../models/StockReservation"
);

// Atomically link an existing Razorpay order
// to the Loomzi order and checkout attempt.
//
// IMPORTANT:
// Razorpay order creation has already happened.
// This transaction only updates MongoDB.
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

  // 3. Validate amount
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error("Invalid payment amount");
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
      //
      // A different existing ID indicates
      // an uncertain or conflicting payment.
      if (
        attempt.recoveryRazorpayOrderId &&
        attempt.recoveryRazorpayOrderId !==
          razorpayOrderId
      ) {
        throw new Error(
          "Conflicting Razorpay order ID requires reconciliation"
        );
      }

      // 6. Verify Loomzi order
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
          "Pending Loomzi order not found"
        );
      }

      const expectedAmountInPaise = Math.round(
        order.totalAmount * 100
      );

      if (
        !Number.isSafeInteger(expectedAmountInPaise) ||
        expectedAmountInPaise !== amountInPaise
      ) {
        throw new Error(
          "Loomzi order amount does not match checkout"
        );
      }

      // 7. Verify stock reservation
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

      // 8. Link Razorpay order to Loomzi order
      const updatedOrder =
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            user: userId,
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

      // 9. Link Razorpay order to checkout attempt
      const updatedAttempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attemptId,
            user: userId,
            order: orderId,
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

      // 10. Return linked payment details
      result = {
        orderId: updatedOrder._id,
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
