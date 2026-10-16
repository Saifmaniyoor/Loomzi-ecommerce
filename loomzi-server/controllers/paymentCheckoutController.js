
const mongoose = require("mongoose");

const checkoutAttemptServices = require(
  "../services/checkoutAttemptServices"
);

const addressServices = require(
  "../services/addressServices"
);

const couponServices = require(
  "../services/couponServices"
);

const {
  calculateCartSummary,
} = require("../utils/cartCalculator");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

const {
  calculateCouponDiscount,
  calculateFinalAmount,
} = require("../utils/checkoutCalculation");

// Validate and calculate checkout details.
// Does NOT create an order or charge the customer.
const validatePaymentCheckout = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Validate idempotency key.
    const idempotencyKey = validateIdempotencyKey(
      req.get("Idempotency-Key")
    );

    // 2. Normalize request details.
    const normalizedRequest =
      normalizeCheckoutRequest(req.body || {});

    const requestHash =
      createRequestHash(normalizedRequest);

    // 3. Find existing checkout attempt.
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

    if (attempt.requestHash !== requestHash) {
      return res.status(409).json({
        message:
          "Idempotency key was used with different checkout details",
      });
    }

    if (attempt.status !== "Processing") {
      return res.status(409).json({
        message:
          "Checkout attempt is not available for a new payment",
      });
    }

    if (attempt.order) {
      return res.status(409).json({
        message:
          "Checkout attempt is already linked to an order",
      });
    }

    // 4. Validate address ownership.
    const address =
      await addressServices.findUserAddressById(
        normalizedRequest.addressId,
        userId
      );

    if (!address) {
      return res.status(404).json({
        message: "Delivery address not found",
      });
    }

    // 5. Recalculate cart using backend data.
    const cartSummary =
      await calculateCartSummary(userId);

    if (
      !cartSummary.items ||
      cartSummary.items.length === 0
    ) {
      return res.status(400).json({
        message: "Your cart is empty",
      });
    }

    if (cartSummary.hasUnavailableItems) {
      return res.status(409).json({
        message:
          "Some cart items are unavailable or out of stock",
      });
    }

    // 6. Validate coupon.
    let coupon = null;
    let discount = 0;

    if (normalizedRequest.couponCode) {
      coupon =
        await couponServices.findCouponByCode(
          normalizedRequest.couponCode
        );

      if (!coupon) {
        return res.status(400).json({
          message: "Invalid coupon code",
        });
      }

      discount = calculateCouponDiscount({
        subtotal: cartSummary.subtotal,
        coupon,
      });
    }

    // 7. Calculate payment amount.
    const paymentSummary = calculateFinalAmount({
      subtotal: cartSummary.subtotal,
      shippingCharge: cartSummary.shippingCharge,
      discount,
    });

    // 8. Return validated checkout details.
    return res.status(200).json({
      message: "Payment checkout validated",
      attemptId: attempt._id,
      address: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      items: cartSummary.items,
      coupon: coupon
        ? {
            code: coupon.code,
            discountAmount: discount,
          }
        : null,
      paymentSummary,
    });

  } catch (error) {
    const validationMessages = [
      "Valid Idempotency-Key header is required",
      "Valid delivery address is required",
      "Invalid coupon code",
      "Coupon is inactive",
      "Coupon has expired",
      "Invalid payment amount",
    ];

    if (
      validationMessages.includes(error.message) ||
      error.message.startsWith("Minimum purchase of")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error(
      "Validate payment checkout error:",
      error
    );

    return res.status(500).json({
      message: "Failed to validate payment checkout",
    });
  }
};

module.exports = {
  validatePaymentCheckout,
};
