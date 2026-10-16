
const Coupon = require("../models/Coupon");

const {
  calculateCouponDiscount,
} = require("../utils/checkoutCalculation");

// Validate coupon and its discount inside a transaction.
const validateCouponForCheckout = async ({
  couponCode,
  subtotal,
  expectedDiscount,
  session,
}) => {
  if (!session) {
    throw new Error(
      "Coupon validation requires a transaction"
    );
  }

  // No coupon: discount must be zero.
  if (!couponCode) {
    if (expectedDiscount !== 0) {
      throw new Error("Invalid coupon discount");
    }

    return null;
  }

  if (
    typeof couponCode !== "string" ||
    typeof expectedDiscount !== "number" ||
    !Number.isFinite(expectedDiscount)
  ) {
    throw new Error("Invalid coupon details");
  }

  // A conditional write coordinates with admin
  // updates to the same coupon document.
  const coupon = await Coupon.findOneAndUpdate(
    {
      code: couponCode.trim().toUpperCase(),
      isActive: true,
      expiresAt: { $gt: new Date() },
    },
    {
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      new: true,
      session,
    }
  );

  if (!coupon) {
    throw new Error(
      "Coupon is unavailable or has expired"
    );
  }

  // Recalculate using the current coupon rules.
  const actualDiscount = calculateCouponDiscount({
    subtotal,
    coupon,
  });

  if (
    Math.round(actualDiscount * 100) !==
    Math.round(expectedDiscount * 100)
  ) {
    throw new Error(
      "Coupon discount changed. Please refresh checkout."
    );
  }

  return coupon;
};

module.exports = {
  validateCouponForCheckout,
};
