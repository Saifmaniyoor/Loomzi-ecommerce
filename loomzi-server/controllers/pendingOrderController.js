
const {
  createPendingCheckoutOrder,
} = require("../services/checkoutOrchestrationServices");

// =====================================================
// CREATE PENDING CHECKOUT ORDER
// =====================================================
//
// Supports:
// 1. Razorpay-only checkout
// 2. Wallet-only checkout
// 3. Wallet + Razorpay split checkout
//
// COD continues through its separate controller.
//
// The service handles:
// - Idempotency validation
// - Trusted order preparation
// - Wallet allocation
// - Stock and wallet reservation
// - Wallet-only payment confirmation
// - Existing checkout recovery
// =====================================================

const createPendingOrder = async (req, res) => {
  try {
    const userId = req.user._id;

    const idempotencyKey = req.get("Idempotency-Key");

    // 1. Delegate checkout processing
    // to the orchestration service.
    const result = await createPendingCheckoutOrder({
      userId,
      idempotencyKey,
      requestBody: req.body || {},
    });

    if (!result) {
      throw new Error(
        "Checkout service returned no result"
      );
    }

    // 2. Validate returned payment method.
    const allowedMethods = [
      "Razorpay",
      "Wallet",
      "Wallet+Razorpay",
    ];

    if (!allowedMethods.includes(result.paymentMethod)) {
      throw new Error(
        "Unexpected checkout payment method"
      );
    }

    if (!result.orderId) {
      throw new Error(
        "Checkout service returned no order ID"
      );
    }

    // 3. Wallet-only checkout.
    //
    // Wallet confirmation must already be
    // completed inside the orchestration service.
    if (result.paymentMethod === "Wallet") {
      if (result.status !== "Completed") {
        return res.status(409).json({
          message:
            "Wallet checkout is not confirmed. Reconciliation required.",
          orderId: result.orderId,
          paymentMethod: "Wallet",
          status: result.status,
        });
      }

      return res.status(
        result.created ? 201 : 200
      ).json({
        message: result.message,
        orderId: result.orderId,
        attemptId: result.attemptId ?? null,
        paymentMethod: "Wallet",
        paymentStatus: "Paid",
        orderStatus: "Confirmed",
        status: "Completed",
        paymentBreakdown: result.paymentBreakdown,
        alreadyExists: !result.created,
      });
    }

    // 4. Razorpay-only or Wallet + Razorpay checkout.
    //
    // These payments are not yet completed.
    // The frontend needs attemptId and orderId
    // to create the Razorpay payment order.
    if (!result.attemptId) {
      throw new Error(
        "Checkout service returned no attempt ID"
      );
    }

    return res.status(
      result.created ? 201 : 200
    ).json({
      message: result.message,
      orderId: result.orderId,
      attemptId: result.attemptId,
      paymentMethod: result.paymentMethod,
      status: result.status,
      paymentStatus: "Pending",
      paymentBreakdown: result.paymentBreakdown,
      alreadyExists: !result.created,
      nextStep: "CREATE_RAZORPAY_ORDER",
    });
  } catch (error) {
    const message =
      error?.message || "Unknown checkout error";

    // 5. Invalid requests.
    const badRequestMessages = [
      "Valid Idempotency-Key header is required",
      "Valid delivery address is required",
      "Invalid coupon code",
      "Invalid payment amount",
      "Invalid checkout total",
      "Invalid wallet balance",
      "Your cart is empty",
      "Delivery address not found",
      "Coupon is inactive",
      "Coupon has expired",
      "LOOMZI10 requires Razorpay payment and cannot be used for wallet-only checkout",
    ];

    if (
      badRequestMessages.includes(message) ||
      message.startsWith("Minimum purchase of")
    ) {
      return res.status(400).json({
        message,
      });
    }

    // 6. Checkout conflicts.
    const conflictMessages = [
      "Checkout attempt not found. Prepare checkout first.",
      "Idempotency key was used with different checkout details",
      "Checkout attempt is not available for order creation",
      "Checkout payment method changed. Prepare a new checkout attempt.",
      "Checkout payment method mismatch",
      "Checkout attempt references a missing order",
      "Wallet checkout requires reconciliation",
      "Some cart items are unavailable or out of stock",
      "Checkout attempt already linked or unavailable",
      "Coupon is unavailable or has expired",
      "Coupon discount changed. Please refresh checkout.",
      "Shipping charge changed. Please refresh checkout.",
      "Product is unavailable. Please refresh your cart.",
      "Product category changed during checkout",
    ];

    if (
      conflictMessages.includes(message) ||
      message.startsWith(
        "Product price, stock, or listing has changed"
      ) ||
      message.includes("stock reservation expired")
    ) {
      return res.status(409).json({
        message,
      });
    }

    // 7. Unexpected errors.
    console.error(
      "Create pending order error:",
      error
    );

    return res.status(500).json({
      message: "Failed to process checkout order",
    });
  }
};

module.exports = {
  createPendingOrder,
};
