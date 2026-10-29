const mongoose = require("mongoose");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

const { prepareOrderData } = require("../utils/checkoutPreparation");

const checkoutAttemptServices = require("../services/checkoutAttemptServices");

const orderServices = require("../services/orderServices");

const { createCODOrder } = require("../services/codOrderServices");

// ======================================
// COD Checkout Controller
// ======================================

const placeCODOrder = async (req, res) => {
  try {
    // 1. Get logged-in customer
    const userId = req.user?._id || req.session?.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Please login to continue",
      });
    }

    // 2. Validate idempotency key
    const idempotencyKey = validateIdempotencyKey(
      req.headers["idempotency-key"],
    );

    // 3. Validate address and coupon
    const normalizedRequest = normalizeCheckoutRequest(req.body || {});

    // 4. Include payment method in request hash
    const requestHash = createRequestHash({
      ...normalizedRequest,
      paymentMethod: "COD",
    });

    // 5. Find or create COD checkout attempt
    const attempt = await checkoutAttemptServices.findOrCreateAttempt({
      userId,
      idempotencyKey,
      requestHash,
      paymentMethod: "COD",
    });

    // 6. Prevent reusing key for another request
    if (
      attempt.requestHash !== requestHash ||
      attempt.paymentMethod !== "COD"
    ) {
      return res.status(409).json({
        message:
          "This idempotency key was already used for a different checkout request",
      });
    }

    // 7. Return existing completed COD order
    if (attempt.status === "Completed" && attempt.order) {
      const existingOrder = await orderServices.findUserOrderById(
        attempt.order,
        userId,
      );

      if (existingOrder && existingOrder.paymentMethod === "COD") {
        return res.status(200).json({
          message: "COD order already placed",
          orderId: existingOrder._id,
          orderStatus: existingOrder.orderStatus,
          paymentStatus: existingOrder.paymentStatus,
          totalAmount: existingOrder.totalAmount,
        });
      }

      return res.status(409).json({
        message:
          "Checkout attempt is completed but the order could not be verified",
      });
    }

    // 8. Reject attempts in unexpected states
    if (attempt.status !== "Processing" || attempt.order) {
      return res.status(409).json({
        message: "Checkout attempt is already being used or is unavailable",
      });
    }

    // 9. Prepare order using current backend data
    const preparedOrder = await prepareOrderData({
      userId,
      addressId: normalizedRequest.addressId,
      couponCode: normalizedRequest.couponCode,
    });

    // 10. Create confirmed COD order atomically
    let order;

    try {
      order = await createCODOrder({
        attemptId: attempt._id,
        userId,
        ...preparedOrder,
      });
    } catch (error) {
      // A concurrent request may have completed
      // this same checkout attempt.
      const latestAttempt = await checkoutAttemptServices.findAttemptById(
        attempt._id,
      );

      if (
        latestAttempt &&
        String(latestAttempt.user) === String(userId) &&
        latestAttempt.requestHash === requestHash &&
        latestAttempt.paymentMethod === "COD" &&
        latestAttempt.status === "Completed" &&
        latestAttempt.order
      ) {
        const existingOrder = await orderServices.findUserOrderById(
          latestAttempt.order,
          userId,
        );

        if (existingOrder && existingOrder.paymentMethod === "COD") {
          return res.status(200).json({
            message: "COD order already placed",
            orderId: existingOrder._id,
            orderStatus: existingOrder.orderStatus,
            paymentStatus: existingOrder.paymentStatus,
            totalAmount: existingOrder.totalAmount,
          });
        }
      }

      throw error;
    }

    // 11. Return successful COD order
    return res.status(201).json({
      message: "COD order placed successfully",
      orderId: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
    });
  } catch (error) {
    console.error("COD checkout error:", error);

    // Invalid request data
    if (
      error.message === "Valid Idempotency-Key header is required" ||
      error.message === "Valid delivery address is required" ||
      error.message === "Invalid coupon code"
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Stock, coupon, or checkout validation errors
    const validationMessages = [
      "Your cart is empty",
      "Some cart items are unavailable or out of stock",
      "Delivery address not found",
      "COD order subtotal mismatch",
      "COD checkout amount mismatch",
      "COD checkout attempt is already used or unavailable",
      "Cart is empty or already checked out",
      "Your cart changed during checkout. Please review your cart.",
    ];

    if (
      validationMessages.includes(error.message) ||
      error.message.startsWith("Product ")
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    if (
      error.name === "VersionError" ||
      error.code === 112 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      return res.status(409).json({
        message:
          "Your cart or order was updated by another request. Please refresh and try again.",
      });
    }

    return res.status(500).json({
      message: "Failed to place COD order",
    });
  }
};

const getCODCheckoutStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Please login to continue",
      });
    }

    const idempotencyKey = validateIdempotencyKey(
      req.headers["idempotency-key"],
    );

    const attempt = await checkoutAttemptServices.findAttempt(
      userId,
      idempotencyKey,
    );

    if (!attempt || attempt.paymentMethod !== "COD") {
      return res.status(404).json({
        message: "COD checkout attempt not found",
      });
    }

    if (attempt.status === "Completed" && attempt.order) {
      const order = await orderServices.findUserOrderById(
        attempt.order,
        userId,
      );

      if (!order || order.paymentMethod !== "COD") {
        return res.status(409).json({
          message: "Completed order could not be verified",
        });
      }

      return res.status(200).json({
        status: "Completed",
        orderId: order._id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
      });
    }

    return res.status(200).json({
      status: attempt.status,
      orderId: null,
    });
  } catch (error) {
    if (error.message === "Valid Idempotency-Key header is required") {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("COD status error:", error);

    return res.status(500).json({
      message: "Failed to check COD checkout status",
    });
  }
};

module.exports = {
  placeCODOrder,
  getCODCheckoutStatus,
};
