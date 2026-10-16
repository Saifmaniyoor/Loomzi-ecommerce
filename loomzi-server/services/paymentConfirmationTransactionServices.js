
const mongoose = require("mongoose");

const Order = require("../models/Order");

const CheckoutAttempt = require(
  "../models/CheckoutAttempt"
);

const StockReservation = require(
  "../models/StockReservation"
);

const WebhookEvent = require(
  "../models/WebhookEvent"
);

const {
  validateWebhookPaymentMatch,
} = require("../utils/validateWebhookPaymentMatch");

// IMPORTANT:
// This function only updates MongoDB.
//
// The caller MUST first verify that the payment
// is captured directly with Razorpay.
//
// For webhook recovery, pass webhookContext.
// For normal user confirmation, omit it.

const confirmCapturedPaymentTransaction = async ({
  userId,
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  webhookContext = null,
}) => {
  // ==========================================
  // 1. VALIDATE INPUTS
  // ==========================================

  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId) ||
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId) ||
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpayPaymentId)
  ) {
    throw new Error(
      "Invalid payment confirmation details"
    );
  }

  if (
    webhookContext !== null &&
    (
      typeof webhookContext !== "object" ||
      Array.isArray(webhookContext) ||
      typeof webhookContext.eventId !== "string" ||
      !webhookContext.eventId.trim() ||
      typeof webhookContext.processingToken !== "string" ||
      !webhookContext.processingToken.trim()
    )
  ) {
    throw new Error(
      "Invalid webhook ownership details"
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // ==========================================
      // 2. FIND MATCHING LOOMZI ORDER
      // ==========================================

      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        razorpayOrderId,
      }).session(session);

      if (!order) {
        throw new Error(
          "Matching Loomzi order not found"
        );
      }

      // ==========================================
      // 3. VALIDATE ORDER AMOUNT
      // ==========================================

      const expectedAmountInPaise = Math.round(
        order.totalAmount * 100
      );

      if (
        !Number.isSafeInteger(expectedAmountInPaise) ||
        expectedAmountInPaise < 100
      ) {
        throw new Error(
          "Invalid Loomzi order amount"
        );
      }

      // ==========================================
      // 4. VALIDATE AND CLAIM WEBHOOK EVENT
      // ==========================================

      if (webhookContext) {
        const normalizedEventId =
          webhookContext.eventId.trim();

        const normalizedToken =
          webhookContext.processingToken.trim();

        // Find only the webhook owned by
        // this recovery worker.
        const webhookEvent =
          await WebhookEvent.findOne({
            eventId: normalizedEventId,
            status: "Processing",
            processingToken: normalizedToken,
            eventType: "payment.captured",
          }).session(session);

        if (!webhookEvent) {
          throw new Error(
            "Webhook ownership changed or event is not processing"
          );
        }

        // Verify that the stored webhook
        // describes this exact payment.
        const paymentMatch =
          validateWebhookPaymentMatch({
            event: webhookEvent,
            razorpayOrderId,
            razorpayPaymentId,
            amountInPaise: expectedAmountInPaise,
          });

        if (!paymentMatch.valid) {
          throw new Error(
            `Webhook payment mismatch: ${paymentMatch.reason}`
          );
        }

        // Conditional WRITE within the
        // transaction prevents stale workers
        // from committing payment confirmation.
        const updatedWebhook =
          await WebhookEvent.findOneAndUpdate(
            {
              _id: webhookEvent._id,
              status: "Processing",
              processingToken: normalizedToken,
              eventType: "payment.captured",
            },
            {
              $set: {
                status: "Processed",
                processedAt: new Date(),
                processingStartedAt: null,
                processingToken: null,
                lastError: null,
              },
            },
            {
              returnDocument: "after",
              runValidators: true,
              session,
            }
          );

        if (!updatedWebhook) {
          throw new Error(
            "Could not complete webhook event"
          );
        }
      }

      // ==========================================
      // 5. HANDLE DUPLICATE CONFIRMATION
      // ==========================================

      if (order.paymentStatus === "Paid") {
        if (
          order.razorpayPaymentId !== razorpayPaymentId
        ) {
          throw new Error(
            "Order was paid using a different payment"
          );
        }

        // If this was a webhook confirmation,
        // the event has also been marked
        // Processed in this transaction.

        result = {
          orderId: order._id,
          paymentStatus: "Paid",
          orderStatus: order.orderStatus,
          razorpayPaymentId,
          alreadyConfirmed: true,
        };

        return;
      }

      // ==========================================
      // 6. VERIFY ORDER IS PENDING
      // ==========================================

      if (
        order.paymentStatus !== "Pending" ||
        order.orderStatus !== "Pending" ||
        order.razorpayPaymentId
      ) {
        throw new Error(
          "Order requires payment reconciliation"
        );
      }

      // ==========================================
      // 7. VERIFY CHECKOUT ATTEMPT
      // ==========================================

      const attempt =
        await CheckoutAttempt.findOne({
          user: userId,
          order: orderId,
          razorpayOrderId,
          status: "Ready",
          amountInPaise: expectedAmountInPaise,
          currency: "INR",
        }).session(session);

      if (!attempt) {
        throw new Error(
          "Matching checkout attempt not found"
        );
      }

      // ==========================================
      // 8. VERIFY STOCK RESERVATION
      // ==========================================

      const reservation =
        await StockReservation.findOne({
          order: orderId,
          user: userId,
          status: "Active",
        }).session(session);

      if (!reservation) {
        throw new Error(
          "Active stock reservation not found. Payment requires reconciliation."
        );
      }

      // An expired reservation may still be
      // Active while payment is being confirmed.
      // Do not release it solely because
      // its expiry timestamp has passed.

      // ==========================================
      // 9. MARK ORDER AS PAID
      // ==========================================

      const updatedOrder =
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            user: userId,
            paymentStatus: "Pending",
            orderStatus: "Pending",
            razorpayOrderId,
            razorpayPaymentId: null,
          },
          {
            $set: {
              paymentStatus: "Paid",
              razorpayPaymentId,
              orderStatus: "Confirmed",
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
          "Could not confirm Loomzi payment"
        );
      }

      // ==========================================
      // 10. COMPLETE STOCK RESERVATION
      // ==========================================

      const updatedReservation =
        await StockReservation.findOneAndUpdate(
          {
            _id: reservation._id,
            order: orderId,
            user: userId,
            status: "Active",
          },
          {
            $set: {
              status: "Completed",
              completedAt: new Date(),
            },
          },
          {
            returnDocument: "after",
            runValidators: true,
            session,
          }
        );

      if (!updatedReservation) {
        throw new Error(
          "Could not complete stock reservation"
        );
      }

      // ==========================================
      // 11. COMPLETE CHECKOUT ATTEMPT
      // ==========================================

      const updatedAttempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attempt._id,
            user: userId,
            order: orderId,
            razorpayOrderId,
            status: "Ready",
            amountInPaise: expectedAmountInPaise,
            currency: "INR",
          },
          {
            $set: {
              status: "Completed",
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
          "Could not complete checkout attempt"
        );
      }

      // ==========================================
      // 12. RETURN CONFIRMATION RESULT
      // ==========================================

      result = {
        orderId: updatedOrder._id,
        paymentStatus: "Paid",
        orderStatus: "Confirmed",
        razorpayPaymentId,
        alreadyConfirmed: false,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  confirmCapturedPaymentTransaction,
};
