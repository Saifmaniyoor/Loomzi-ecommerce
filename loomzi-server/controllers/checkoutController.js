
const mongoose = require("mongoose");

const addressServices = require("../services/addressServices");
const couponServices = require("../services/couponServices");

const {
  calculateCartSummary,
} = require("../utils/cartCalculator");

const {
  calculateCouponDiscount,
  calculateFinalAmount,
} = require("../utils/checkoutCalculation");

const roundAmount = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const previewCheckout = async (req, res) => {
  try {
    const userId = req.user?._id || req.session?.userId;
    const { addressId, couponCode } = req.body || {};

    // 1. Validate delivery address ID
    if (
      typeof addressId !== "string" ||
      !mongoose.isValidObjectId(addressId)
    ) {
      return res.status(400).json({
        message: "Valid delivery address is required",
      });
    }

    // 2. Validate optional coupon code
    if (
      couponCode !== undefined &&
      couponCode !== null &&
      (typeof couponCode !== "string" ||
        !couponCode.trim())
    ) {
      return res.status(400).json({
        message: "Invalid coupon code",
      });
    }

    // 3. Find customer's delivery address
    const address = await addressServices.findUserAddressById(
      addressId,
      userId
    );

    if (!address) {
      return res.status(404).json({
        message: "Delivery address not found",
      });
    }

    // 4. Calculate latest cart summary
    const cart = await calculateCartSummary(userId);

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        message: "Your cart is empty",
      });
    }

    if (cart.hasUnavailableItems) {
      return res.status(400).json({
        message:
          "Some cart items are unavailable. Please update your cart.",
      });
    }

    // 5. Get product offer savings
    const offerSavings = roundAmount(
      Number(cart.totalSavings ?? 0)
    );

    const originalSubtotal = roundAmount(
      Number(cart.subtotal) + offerSavings
    );

    // 6. Validate coupon and calculate discount
    let appliedCoupon = null;
    let discount = 0;

    if (couponCode) {
      const normalizedCode = couponCode
        .trim()
        .toUpperCase();

      const coupon = await couponServices.findCouponByCode(
        normalizedCode
      );

      if (!coupon) {
        return res.status(404).json({
          message: "Invalid coupon code",
        });
      }

      try {
        discount = calculateCouponDiscount({
          subtotal: cart.subtotal,
          coupon,
        });
      } catch (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      appliedCoupon = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
      };
    }

    // 7. Calculate final payment using shared utility
    let paymentSummary;

    try {
      paymentSummary = calculateFinalAmount({
        subtotal: cart.subtotal,
        shippingCharge: cart.shippingCharge,
        discount,
      });
    } catch (error) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // 8. Calculate total savings
    const couponSavings = roundAmount(
      Number(paymentSummary.discount ?? 0)
    );

    const totalSavings = roundAmount(
      offerSavings + couponSavings
    );

    // 9. Return checkout preview
    return res.status(200).json({
      message: "Checkout preview generated successfully",

      shippingAddress: {
        id: address._id,
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },

      items: cart.items,

      // Original subtotal before product offers
      originalSubtotal,

      // Product/category/manual offer savings
      offerSavings,

      // Subtotal after product offers
      subtotal: paymentSummary.subtotal,

      coupon: appliedCoupon,

      // Coupon discount
      discount: paymentSummary.discount,

      // Combined offer and coupon savings
      totalSavings,

      shippingCharge: paymentSummary.shippingCharge,
      tax: paymentSummary.tax,
      finalTotal: paymentSummary.totalAmount,
      currency: paymentSummary.currency,
    });
  } catch (error) {
    console.error("Checkout preview error:", error);

    return res.status(500).json({
      message: "Failed to generate checkout preview",
    });
  }
};

module.exports = {
  previewCheckout,
};
