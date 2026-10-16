
const {
  findCouponByCode,
} = require("../services/couponServices");

const {
  calculateCartSummary,
  roundAmount,
} = require("../utils/cartCalculator");

// POST /api/coupons/validate
const validateCoupon = async (req, res) => {
  try {
    // Get logged-in customer
    const userId = req.user?._id || req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    // Get coupon code from request
    const { code } = req.body || {};

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        message: "Coupon code is required",
      });
    }

    // Convert coupon code to uppercase
    const normalizedCode = code.trim().toUpperCase();

    // Find coupon from MongoDB
    const coupon = await findCouponByCode(normalizedCode);

    if (!coupon) {
      return res.status(404).json({
        message: "Invalid coupon code",
      });
    }

    // Check whether coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({
        message: "This coupon is inactive",
      });
    }

    // Check coupon expiry
    if (new Date() >= new Date(coupon.expiresAt)) {
      return res.status(400).json({
        message: "This coupon has expired",
      });
    }

    // Get actual cart subtotal from backend
    const cart = await calculateCartSummary(userId);

    // Check empty cart
    if (cart.items.length === 0) {
      return res.status(400).json({
        message: "Your cart is empty",
      });
    }

    // Check product and stock availability
    if (cart.hasUnavailableItems) {
      return res.status(400).json({
        message:
          "Some cart items are unavailable. Please update your cart.",
      });
    }

    // Check minimum purchase amount
    if (cart.subtotal < coupon.minimumPurchase) {
      return res.status(400).json({
        message: `Minimum purchase amount is ₹${coupon.minimumPurchase}`,
      });
    }

    // Calculate discount
    // LOOMZI10 = 10%, maximum ₹100
    const discount = roundAmount(
      Math.min(
        cart.subtotal * (coupon.discountValue / 100),
        coupon.maximumDiscount,
        cart.subtotal
      )
    );

    // Subtotal after coupon discount
    const totalAfterDiscount = roundAmount(
      cart.subtotal - discount
    );

    // Add shipping charge
    const finalTotal = roundAmount(
      totalAfterDiscount + cart.shippingCharge
    );

    return res.status(200).json({
      message: "Coupon applied successfully",

      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumPurchase: coupon.minimumPurchase,
        maximumDiscount: coupon.maximumDiscount,
      },

      subtotal: cart.subtotal,
      discount,
      totalAfterDiscount,
      shippingCharge: cart.shippingCharge,
      tax: 0,
      finalTotal,
    });
  } catch (error) {
    console.error("Coupon validation error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  validateCoupon,
};
