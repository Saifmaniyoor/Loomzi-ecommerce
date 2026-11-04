
const mongoose = require("mongoose");

const Order = require("../models/Order");
const Cart = require("../models/Cart");

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

const {
  settlePurchaseReservation,
} = require("./walletLedgerService");

// ==========================================
// PAYMENT AMOUNT VALIDATION
// ==========================================

const getExpectedRazorpayAmount = (order) => {
  const totalPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid Loomzi order amount");
  }

  // Legacy Razorpay orders can have
  // no payment breakdown.
  if (order.paymentMethod === "Razorpay") {
    if (order.paymentBreakdown) {
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

    if (
      !Number.isSafeInteger(breakdown.totalPaise) ||
      !Number.isSafeInteger(breakdown.walletPaise) ||
      !Number.isSafeInteger(breakdown.razorpayPaise) ||
      breakdown.totalPaise !== totalPaise ||
      breakdown.walletPaise <= 0 ||
      breakdown.razorpayPaise < 100 ||
      breakdown.walletPaise +
        breakdown.razorpayPaise !== totalPaise ||
      !["Reserved", "Settled"].includes(
        breakdown.walletStatus
      )
    ) {
      throw new Error(
        "Invalid split payment breakdown"
      );
    }

    return breakdown.razorpayPaise;
  }

  throw new Error(
    "This order does not require Razorpay confirmation"
  );
};

// ==========================================
// CHECK ATTEMPT PAYMENT BREAKDOWN
// ==========================================

const validateAttemptBreakdown = (
  attempt,
  order,
  expectedAmountInPaise
) => {
  if (
    attempt.paymentMethod !== order.paymentMethod ||
    attempt.amountInPaise !== expectedAmountInPaise ||
    attempt.currency !== "INR"
  ) {
    throw new Error(
      "Checkout attempt payment mismatch"
    );
  }

  // Support existing Razorpay-only attempts
  // that do not have paymentBreakdown.
  if (
    order.paymentMethod === "Razorpay" &&
    !attempt.paymentBreakdown
  ) {
    return;
  }

  const a = attempt.paymentBreakdown;
  const o = order.paymentBreakdown;

  if (
    !a ||
    !o ||
    a.totalPaise !== o.totalPaise ||
    a.walletPaise !== o.walletPaise ||
    a.razorpayPaise !== o.razorpayPaise
  ) {
    throw new Error(
      "Checkout payment breakdown mismatch"
    );
  }
};

// ==========================================
// CONFIRM CAPTURED PAYMENT
// ==========================================

// IMPORTANT:
// The caller MUST verify the captured payment
// directly with Razorpay before calling this.
//
// This function only updates MongoDB.
//
// Webhook callers must independently verify
// the webhook signature and fetch/verify
// the captured payment with Razorpay.
//
// Do not use for wallet-only payments.

const confirmCapturedPaymentTransaction = async ({
  userId,
  orderId,
  razorpayOrderId,
  razorpayPaymentId,
  webhookContext = null,
}) => {
  // 1. Validate identifiers
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

  // 2. Validate webhook ownership details
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
      // 3. Find matching Loomzi order
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        razorpayOrderId,
        paymentMethod: {
          $in: ["Razorpay", "Wallet+Razorpay"],
        },
      }).session(session);

      if (!order) {
        throw new Error(
          "Matching Loomzi order not found"
        );
      }

      // 4. Determine Razorpay contribution
      const expectedAmountInPaise =
        getExpectedRazorpayAmount(order);

      const isSplitPayment =
        order.paymentMethod === "Wallet+Razorpay";

      // 5. Validate and claim webhook event
      if (webhookContext) {
        const normalizedEventId =
          webhookContext.eventId.trim();

        const normalizedToken =
          webhookContext.processingToken.trim();

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

        // IMPORTANT:
        // For split payments this is only
        // the Razorpay contribution.
        const paymentMatch =
          validateWebhookPaymentMatch({
            event: webhookEvent,
            razorpayOrderId,
            razorpayPaymentId,
            amountInPaise:
              expectedAmountInPaise,
          });

        if (!paymentMatch.valid) {
          throw new Error(
            `Webhook payment mismatch: ${paymentMatch.reason}`
          );
        }

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

      // 6. Handle duplicate confirmation
      if (order.paymentStatus === "Paid") {
        if (
          order.razorpayPaymentId !== razorpayPaymentId
        ) {
          throw new Error(
            "Order was paid using a different payment"
          );
        }

        if (
          isSplitPayment &&
          order.paymentBreakdown.walletStatus !==
            "Settled"
        ) {
          throw new Error(
            "Paid split order requires wallet reconciliation"
          );
        }

        result = {
          orderId: order._id,
          paymentMethod: order.paymentMethod,
          paymentStatus: "Paid",
          orderStatus: order.orderStatus,
          razorpayPaymentId,
          alreadyConfirmed: true,
        };

        return;
      }

      // 7. Verify pending order
      if (
        order.paymentStatus !== "Pending" ||
        order.orderStatus !== "Pending" ||
        order.razorpayPaymentId
      ) {
        throw new Error(
          "Order requires payment reconciliation"
        );
      }

      if (
        isSplitPayment &&
        order.paymentBreakdown.walletStatus !==
          "Reserved"
      ) {
        throw new Error(
          "Wallet reservation is not available for settlement"
        );
      }

      // 8. Verify checkout attempt
      const attempt =
        await CheckoutAttempt.findOne({
          user: userId,
          order: orderId,
          razorpayOrderId,
          paymentMethod: order.paymentMethod,
          status: "Ready",
          amountInPaise: expectedAmountInPaise,
          currency: "INR",
        }).session(session);

      if (!attempt) {
        throw new Error(
          "Matching checkout attempt not found"
        );
      }

      validateAttemptBreakdown(
        attempt,
        order,
        expectedAmountInPaise
      );

      // 9. Verify active stock reservation
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

      // Do not reject a captured payment
      // solely because expiresAt has passed.
      // Reconcile captured payments before
      // releasing reservations.

      // 10. Settle reserved wallet contribution
      if (isSplitPayment) {
        // This creates the settlement ledger
        // entry but does NOT subtract the
        // wallet balance a second time.
        await settlePurchaseReservation({
          userId,
          orderId,
          session,
        });
      }

      // 11. Mark order as paid
      const orderUpdate = {
        paymentStatus: "Paid",
        razorpayPaymentId,
        orderStatus: "Confirmed",
      };

      if (isSplitPayment) {
        orderUpdate[
          "paymentBreakdown.walletStatus"
        ] = "Settled";
      }

      const orderFilter = {
        _id: orderId,
        user: userId,
        paymentMethod: order.paymentMethod,
        paymentStatus: "Pending",
        orderStatus: "Pending",
        razorpayOrderId,
        razorpayPaymentId: null,
      };

      if (isSplitPayment) {
        orderFilter[
          "paymentBreakdown.walletStatus"
        ] = "Reserved";
      }

      const updatedOrder =
        await Order.findOneAndUpdate(
          orderFilter,
          {
            $set: orderUpdate,
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

      // 12. Complete stock reservation
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

      // 13. Complete checkout attempt
      const updatedAttempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attempt._id,
            user: userId,
            order: orderId,
            paymentMethod: order.paymentMethod,
            razorpayOrderId,
            status: "Ready",
            amountInPaise:
              expectedAmountInPaise,
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

      // 14. Remove only purchased cart lines.
      // Preserve any newly added merchandise.
      const cart = await Cart.findOne({
        user: userId,
      }).session(session);

      if (cart && cart.items.length) {
        const purchased = new Map(
          order.items.map((item) => [
            `${
              String(item.product)
            }:${
              item.variantId
                ? String(item.variantId)
                : ""
            }`,
            Number(item.quantity),
          ])
        );

        const remainingItems =
          cart.items.filter((item) => {
            const key = `${
              String(item.product)
            }:${
              item.variantId
                ? String(item.variantId)
                : ""
            }`;

            return (
              !purchased.has(key) ||
              Number(item.quantity) !==
                purchased.get(key)
            );
          });

        if (
          remainingItems.length !==
          cart.items.length
        ) {
          const updatedCart =
            await Cart.updateOne(
              {
                _id: cart._id,
                user: userId,
                __v: cart.__v,
              },
              {
                $set: {
                  items: remainingItems,
                },
                $inc: {
                  __v: 1,
                },
                $currentDate: {
                  updatedAt: true,
                },
              },
              { session }
            );

          if (
            updatedCart.matchedCount !== 1
          ) {
            throw new Error(
              "Cart changed during payment confirmation; retry reconciliation"
            );
          }
        }
      }

      // 15. Return confirmation
      result = {
        orderId: updatedOrder._id,
        paymentMethod:
          updatedOrder.paymentMethod,
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


/**
 * Confirm a wallet-only checkout.
 *
 * The pending order, wallet reservation,
 * stock reservation, and checkout attempt
 * must already exist.
 *
 * No Razorpay payment is required.
 */
const confirmWalletPaymentTransaction = async ({
  userId,
  orderId,
}) => {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error(
      "Invalid wallet confirmation identifiers"
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Find wallet-only order
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        paymentMethod: "Wallet",
      }).session(session);

      if (!order) {
        throw new Error(
          "Matching wallet order not found"
        );
      }

      // 2. Validate payment breakdown
      const totalPaise = Math.round(
        order.totalAmount * 100
      );

      const breakdown = order.paymentBreakdown;

      if (
        !Number.isSafeInteger(totalPaise) ||
        totalPaise < 100 ||
        !breakdown ||
        breakdown.totalPaise !== totalPaise ||
        breakdown.walletPaise !== totalPaise ||
        breakdown.razorpayPaise !== 0
      ) {
        throw new Error(
          "Invalid wallet-only payment breakdown"
        );
      }

      // Wallet-only orders must not have
      // Razorpay payment identifiers.
      if (
        order.razorpayOrderId ||
        order.razorpayPaymentId
      ) {
        throw new Error(
          "Wallet-only order has Razorpay identifiers"
        );
      }

      // 3. Handle duplicate confirmation
      if (order.paymentStatus === "Paid") {
        if (
          breakdown.walletStatus !== "Settled" ||
          order.orderStatus !== "Confirmed"
        ) {
          throw new Error(
            "Paid wallet order requires reconciliation"
          );
        }

        result = {
          orderId: order._id,
          paymentMethod: "Wallet",
          paymentStatus: "Paid",
          orderStatus: "Confirmed",
          alreadyConfirmed: true,
        };

        return;
      }

      // 4. Verify pending order
      if (
        order.paymentStatus !== "Pending" ||
        order.orderStatus !== "Pending" ||
        breakdown.walletStatus !== "Reserved"
      ) {
        throw new Error(
          "Wallet order requires reconciliation"
        );
      }

      // 5. Verify checkout attempt
      const attempt = await CheckoutAttempt.findOne({
        user: userId,
        order: orderId,
        paymentMethod: "Wallet",
        status: "Processing",
        razorpayOrderId: null,
        recoveryRazorpayOrderId: null,
        amountInPaise: null,
        currency: "INR",
      }).session(session);

      if (!attempt) {
        throw new Error(
          "Matching wallet checkout attempt not found"
        );
      }

      const attemptBreakdown =
        attempt.paymentBreakdown;

      if (
        !attemptBreakdown ||
        attemptBreakdown.totalPaise !== totalPaise ||
        attemptBreakdown.walletPaise !== totalPaise ||
        attemptBreakdown.razorpayPaise !== 0
      ) {
        throw new Error(
          "Wallet checkout attempt breakdown mismatch"
        );
      }

      // 6. Verify active stock reservation
      const reservation =
        await StockReservation.findOne({
          order: orderId,
          user: userId,
          status: "Active",
        }).session(session);

      if (!reservation) {
        throw new Error(
          "Active stock reservation not found"
        );
      }

      // Wallet-only checkout should confirm
      // promptly after reservation.
      if (
        !(reservation.expiresAt instanceof Date) ||
        reservation.expiresAt.getTime() <= Date.now()
      ) {
        throw new Error(
          "Wallet stock reservation expired; reconcile checkout"
        );
      }

      // 7. Settle wallet reservation
      //
      // The wallet balance was already
      // deducted during reservation.
      //
      // Settlement must NOT deduct it again.
      await settlePurchaseReservation({
        userId,
        orderId,
        session,
      });

      // 8. Mark order as Paid and Confirmed
      const updatedOrder =
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            user: userId,
            paymentMethod: "Wallet",
            paymentStatus: "Pending",
            orderStatus: "Pending",
            "paymentBreakdown.walletStatus":
              "Reserved",
            razorpayOrderId: null,
            razorpayPaymentId: null,
          },
          {
            $set: {
              paymentStatus: "Paid",
              orderStatus: "Confirmed",
              "paymentBreakdown.walletStatus":
                "Settled",
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
          "Could not confirm wallet order"
        );
      }

      // 9. Complete stock reservation
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

      // 10. Complete checkout attempt
      const updatedAttempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attempt._id,
            user: userId,
            order: orderId,
            paymentMethod: "Wallet",
            status: "Processing",
            amountInPaise: null,
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
          "Could not complete wallet checkout attempt"
        );
      }

      // 11. Remove purchased cart items
      const cart = await Cart.findOne({
        user: userId,
      }).session(session);

      if (cart && cart.items.length) {
        const purchased = new Map(
          order.items.map((item) => [
            `${
              String(item.product)
            }:${
              item.variantId
                ? String(item.variantId)
                : ""
            }`,
            Number(item.quantity),
          ])
        );

        const remainingItems =
          cart.items.filter((item) => {
            const key = `${
              String(item.product)
            }:${
              item.variantId
                ? String(item.variantId)
                : ""
            }`;

            return (
              !purchased.has(key) ||
              Number(item.quantity) !==
                purchased.get(key)
            );
          });

        if (
          remainingItems.length !==
          cart.items.length
        ) {
          const updatedCart =
            await Cart.updateOne(
              {
                _id: cart._id,
                user: userId,
                __v: cart.__v,
              },
              {
                $set: {
                  items: remainingItems,
                },
                $inc: {
                  __v: 1,
                },
                $currentDate: {
                  updatedAt: true,
                },
              },
              {
                session,
              }
            );

          if (
            updatedCart.matchedCount !== 1
          ) {
            throw new Error(
              "Cart changed during wallet confirmation; retry reconciliation"
            );
          }
        }
      }

      // 12. Return confirmation result
      result = {
        orderId: updatedOrder._id,
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        orderStatus: "Confirmed",
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
  confirmWalletPaymentTransaction,
};
