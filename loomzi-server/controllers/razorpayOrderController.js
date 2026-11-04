
const mongoose = require("mongoose");

const {
  createPaymentOrder,
} = require("../services/paymentOrchestrationServices");

const CheckoutAttempt = require(
  "../models/CheckoutAttempt"
);

const Order = require("../models/Order");

// =====================================================
// SUPPORTED RAZORPAY PAYMENT METHODS
// =====================================================

const RAZORPAY_METHODS = [
  "Razorpay",
  "Wallet+Razorpay",
];

// =====================================================
// CREATE RAZORPAY CHECKOUT ORDER
// =====================================================

const createCheckoutRazorpayOrder = async (
  req,
  res
) => {
  const userId = req.user?._id;

  const { attemptId, orderId } = req.body || {};

  // 1. Validate identifiers
  if (
    !userId ||
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    return res.status(400).json({
      message:
        "Valid attemptId and orderId required",
    });
  }

  try {
    // 2. Find matching checkout attempt
    const attempt =
      await CheckoutAttempt.findOne({
        _id: attemptId,
        user: userId,
        order: orderId,
        paymentMethod: {
          $in: RAZORPAY_METHODS,
        },
      });

    // 3. Find matching order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      paymentMethod: {
        $in: RAZORPAY_METHODS,
      },
    });

    if (!attempt || !order) {
      return res.status(404).json({
        message: "Checkout not found",
      });
    }

    // 4. Payment methods must match
    if (
      attempt.paymentMethod !==
      order.paymentMethod
    ) {
      return res.status(409).json({
        message:
          "Checkout payment method mismatch",
      });
    }

    // 5. Order must still be pending
    if (
      order.paymentStatus !== "Pending" ||
      order.orderStatus !== "Pending"
    ) {
      return res.status(409).json({
        message:
          "Order is not available for payment creation",
      });
    }

    // 6. Verify payment breakdown
    const breakdown =
      order.paymentBreakdown;

    const totalPaise = Math.round(
      order.totalAmount * 100
    );

    if (
      !Number.isSafeInteger(totalPaise) ||
      totalPaise < 100
    ) {
      return res.status(409).json({
        message:
          "Invalid checkout order amount",
      });
    }

    let expectedRazorpayPaise = totalPaise;

    if (
      order.paymentMethod ===
      "Wallet+Razorpay"
    ) {
      if (
        !breakdown ||
        breakdown.totalPaise !== totalPaise ||
        !Number.isSafeInteger(
          breakdown.walletPaise
        ) ||
        !Number.isSafeInteger(
          breakdown.razorpayPaise
        ) ||
        breakdown.walletPaise <= 0 ||
        breakdown.razorpayPaise < 100 ||
        breakdown.walletPaise +
          breakdown.razorpayPaise !==
          totalPaise ||
        breakdown.walletStatus !== "Reserved"
      ) {
        return res.status(409).json({
          message:
            "Invalid split payment allocation",
        });
      }

      expectedRazorpayPaise =
        breakdown.razorpayPaise;
    } else if (breakdown) {
      // Razorpay-only orders must not
      // contain any wallet contribution.
      if (
        breakdown.totalPaise !== totalPaise ||
        breakdown.walletPaise !== 0 ||
        breakdown.razorpayPaise !==
          totalPaise
      ) {
        return res.status(409).json({
          message:
            "Invalid Razorpay payment allocation",
        });
      }
    }

    // 7. Validate checkout attempt amount
    if (
      attempt.amountInPaise !==
      expectedRazorpayPaise
    ) {
      return res.status(409).json({
        message:
          "Checkout attempt amount mismatch",
      });
    }

    // 8. Prevent duplicate Razorpay orders
    //
    // An existing Ready, Creating Payment,
    // or Recovery Required attempt must
    // follow the recovery flow.
    if (attempt.status !== "Processing") {
      return res.status(409).json({
        message:
          "Payment attempt already exists or needs reconciliation. Check your order status; do not retry payment creation.",
      });
    }

    if (
      attempt.razorpayOrderId ||
      attempt.recoveryRazorpayOrderId ||
      order.razorpayOrderId
    ) {
      return res.status(409).json({
        message:
          "Razorpay payment already initiated. Check payment status.",
      });
    }

    // 9. Create Razorpay order
    //
    // The payment service must create
    // the Razorpay order using only the
    // Razorpay contribution for split
    // payments.
    const payment = await createPaymentOrder({
      attemptId,
      userId,
      orderId,
    });

    // 10. Validate provider response
    if (
      !payment ||
      !/^order_[a-zA-Z0-9]+$/.test(
        payment.razorpayOrderId || ""
      ) ||
      !Number.isSafeInteger(
        payment.amountInPaise
      ) ||
      payment.amountInPaise !==
        expectedRazorpayPaise ||
      payment.currency !== "INR"
    ) {
      throw new Error(
        "Razorpay order response invalid"
      );
    }

    // 11. Return Razorpay checkout details
    return res.status(201).json({
      orderId: String(orderId),
      razorpayOrderId:
        payment.razorpayOrderId,
      amountInPaise:
        payment.amountInPaise,
      currency: payment.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      reservationExpiresAt:
        payment.reservationExpiresAt,
      paymentMethod: order.paymentMethod,
      paymentBreakdown:
        breakdown || null,
    });
  } catch (error) {
    console.error(
      "Create Razorpay checkout order:",
      error
    );

    return res.status(409).json({
      message:
        "Payment creation could not be confirmed. Check order status before trying again.",
    });
  }
};

// =====================================================
// GET RAZORPAY CHECKOUT STATUS
// =====================================================

const getRazorpayCheckoutStatus = async (
  req,
  res
) => {
  const userId = req.user?._id;
  const { orderId } = req.params;

  if (
    !userId ||
    !mongoose.isValidObjectId(orderId)
  ) {
    return res.status(400).json({
      message: "Invalid order ID",
    });
  }

  try {
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      paymentMethod: {
        $in: RAZORPAY_METHODS,
      },
    })
      .select(
        "paymentMethod paymentStatus orderStatus razorpayOrderId paymentBreakdown"
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    return res.status(200).json({
      orderId: String(orderId),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      hasRazorpayOrder: Boolean(
        order.razorpayOrderId
      ),
      paymentBreakdown:
        order.paymentBreakdown || null,
    });
  } catch (error) {
    console.error(
      "Get Razorpay checkout status:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to retrieve checkout status",
    });
  }
};

module.exports = {
  createCheckoutRazorpayOrder,
  getRazorpayCheckoutStatus,
};
