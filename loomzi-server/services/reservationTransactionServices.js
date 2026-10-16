
const mongoose = require("mongoose");

const Order = require("../models/Order");
const CheckoutAttempt = require("../models/CheckoutAttempt");
const StockReservation = require("../models/StockReservation");

const inventoryServices = require("./inventoryServices");

// =====================================================
// 1. RELEASE RESERVED ORDER
// =====================================================

// Internal operation only.
//
// WARNING:
// Do not call this function unless an independent
// payment-reconciliation workflow has confirmed
// that releasing this order is safe.
//
// A local "Pending" status alone does not prove
// that no Razorpay payment exists.
const releaseReservedOrder = async (orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new Error("Invalid order ID");
  }

  const session = await mongoose.startSession();

  try {
    let result = {
      released: false,
      message: "Reservation was not released",
    };

    await session.withTransaction(async () => {
      // 1. Find the order
      const order = await Order.findById(
        orderId
      ).session(session);

      if (!order) {
        throw new Error("Order not found");
      }

      // 2. Find stock reservation
      const reservation =
        await StockReservation.findOne({
          order: orderId,
        }).session(session);

      if (!reservation) {
        throw new Error(
          "Stock reservation not found"
        );
      }

      // 3. Check whether reservation is active
      if (reservation.status !== "Active") {
        result = {
          released: false,
          message: "Reservation already finalized",
        };
        return;
      }

      // 4. Never release an order marked as paid
      if (order.paymentStatus !== "Pending") {
        throw new Error(
          "Payment status does not allow stock release"
        );
      }

      // 5. Claim reservation for release
      const claimed =
        await StockReservation.findOneAndUpdate(
          {
            _id: reservation._id,
            status: "Active",
          },
          {
            $set: {
              status: "Released",
              releasedAt: new Date(),
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!claimed) {
        throw new Error(
          "Reservation changed during release"
        );
      }

      // 6. Restore reserved stock
      for (const item of reservation.items) {
        const restored =
          await inventoryServices.releaseStock({
            productId: item.product,
            variantId: item.variantId,
            quantity: item.quantity,
            session,
          });

        if (!restored) {
          throw new Error(
            `Failed to restore stock for product ${item.product}`
          );
        }
      }

      // 7. Close unpaid order
      const updatedOrder =
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            paymentStatus: "Pending",
          },
          {
            $set: {
              paymentStatus: "Failed",
              orderStatus: "Cancelled",
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!updatedOrder) {
        throw new Error(
          "Order payment status changed during release"
        );
      }

      result = {
        released: true,
        message:
          "Reserved stock restored successfully",
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// =====================================================
// 2. RELEASE EXPIRED UNPAID CHECKOUT
// =====================================================

// Internal operation only.
//
// Use only for a checkout that is independently known
// to have never initiated a Razorpay request.
//
// Null Razorpay IDs in MongoDB alone are not sufficient
// evidence that no external payment order was created.
const releaseExpiredUnpaidCheckout = async ({
  orderId,
  userId,
}) => {
  // 1. Validate IDs
  if (
    !mongoose.isValidObjectId(orderId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new Error(
      "Invalid order or user ID"
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 2. Find checkout attempt
      const attempt =
        await CheckoutAttempt.findOne({
          order: orderId,
          user: userId,
          status: "Processing",
          razorpayOrderId: null,
          recoveryRazorpayOrderId: null,
        }).session(session);

      if (!attempt) {
        throw new Error(
          "Checkout attempt requires reconciliation"
        );
      }

      // 3. Verify order is unpaid and pending
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
          "Order requires payment reconciliation"
        );
      }

      // 4. Find expired active reservation
      const reservation =
        await StockReservation.findOne({
          order: orderId,
          user: userId,
          status: "Active",
          expiresAt: {
            $lte: new Date(),
          },
        }).session(session);

      if (!reservation) {
        throw new Error(
          "Expired active reservation not found"
        );
      }

      // 5. Claim checkout attempt
      // This coordinates with the atomic payment claim.
      const claimedAttempt =
        await CheckoutAttempt.findOneAndUpdate(
          {
            _id: attempt._id,
            user: userId,
            order: orderId,
            status: "Processing",
            razorpayOrderId: null,
            recoveryRazorpayOrderId: null,
          },
          {
            $set: {
              status: "Failed",
              errorMessage:
                "Checkout expired before payment initiation",
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!claimedAttempt) {
        throw new Error(
          "Checkout attempt changed during cleanup"
        );
      }

      // 6. Restore reserved stock quantities
      for (const item of reservation.items) {
        const updatedProduct =
          await inventoryServices.releaseStock({
            productId: item.product,
            variantId: item.variantId,
            quantity: item.quantity,
            session,
          });

        if (!updatedProduct) {
          throw new Error(
            `Stock restoration failed for product ${item.product}`
          );
        }
      }

      // 7. Mark reservation as Released
      const releasedReservation =
        await StockReservation.findOneAndUpdate(
          {
            _id: reservation._id,
            user: userId,
            order: orderId,
            status: "Active",
          },
          {
            $set: {
              status: "Released",
              releasedAt: new Date(),
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      if (!releasedReservation) {
        throw new Error(
          "Could not release reservation"
        );
      }

      // 8. Mark order as Failed and Cancelled
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
              paymentStatus: "Failed",
              orderStatus: "Cancelled",
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          }
        );

      // 9. Verify order update succeeded
      if (!updatedOrder) {
        throw new Error(
          "Order changed during reservation cleanup"
        );
      }

      // 10. Prepare result
      result = {
        success: true,
        orderId,
        reservationStatus: "Released",
        checkoutStatus: "Failed",
        orderStatus: "Cancelled",
        paymentStatus: "Failed",
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  releaseReservedOrder,
  releaseExpiredUnpaidCheckout,
};
