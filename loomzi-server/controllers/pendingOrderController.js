
const checkoutAttemptServices = require(
  "../services/checkoutAttemptServices"
);

const {
  prepareOrderData,
} = require("../utils/checkoutPreparation");

const {
  createPendingOrderWithReservation,
} = require("../services/orderTransactionServices");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

// Create pending order without contacting Razorpay.
const createPendingOrder = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Validate idempotency key
    const idempotencyKey = validateIdempotencyKey(
      req.get("Idempotency-Key")
    );

    // 2. Normalize checkout details
    const normalizedRequest =
      normalizeCheckoutRequest(req.body || {});

    const requestHash =
      createRequestHash(normalizedRequest);

    // 3. Find existing checkout attempt
    const attempt =
      await checkoutAttemptServices.findAttempt(
        userId,
        idempotencyKey
      );

    if (!attempt) {
      return res.status(404).json({
        message:
          "Checkout attempt not found. Prepare checkout first.",
      });
    }

    // 4. Reject reuse with different details
    if (attempt.requestHash !== requestHash) {
      return res.status(409).json({
        message:
          "Idempotency key was used with different checkout details",
      });
    }

    // 5. Return existing pending order for a retry
    if (attempt.order) {
      return res.status(200).json({
        message: "Checkout order already exists",
        attemptId: attempt._id,
        orderId: attempt.order,
        status: attempt.status,
      });
    }

    // 6. Verify attempt is available
    if (attempt.status !== "Processing") {
      return res.status(409).json({
        message:
          "Checkout attempt is not available for order creation",
      });
    }

    // 7. Prepare order from backend data
    const orderData = await prepareOrderData({
      userId,
      addressId: normalizedRequest.addressId,
      couponCode: normalizedRequest.couponCode,
    });

    // 8. Create order and reserve stock atomically
    const order =
      await createPendingOrderWithReservation({
        attemptId: attempt._id,
        userId,
        ...orderData,
      });

    // 9. Return pending order details
    return res.status(201).json({
      message: "Pending order created successfully",
      attemptId: attempt._id,
      orderId: order._id,
      status: "Pending",
      totalAmount: order.totalAmount,
      currency: "INR",
    });
  } catch (error) {
    const badRequestMessages = [
      "Valid Idempotency-Key header is required",
      "Valid delivery address is required",
      "Invalid coupon code",
      "Invalid payment amount",
      "Your cart is empty",
      "Delivery address not found",
      "Coupon is inactive",
      "Coupon has expired",
    ];

    if (
      badRequestMessages.includes(error.message) ||
      error.message.startsWith("Minimum purchase of")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    const conflictMessages = [
      "Some cart items are unavailable or out of stock",
      "Checkout attempt already linked or unavailable",
      "Coupon is unavailable or has expired",
      "Coupon discount changed. Please refresh checkout.",
      "Shipping charge changed. Please refresh checkout.",
      "Product is unavailable. Please refresh your cart.",
      "Product category changed during checkout",
    ];

    if (
      conflictMessages.includes(error.message) ||
      error.message.startsWith(
        "Product price, stock, or listing has changed"
      )
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    console.error("Create pending order error:", error);

    return res.status(500).json({
      message: "Failed to create pending order",
    });
  }
};

module.exports = {
  createPendingOrder,
};
