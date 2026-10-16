
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Coupon = require("../models/Coupon");

const {
  validateCouponForCheckout,
} = require("../services/couponValidationServices");

const runTest = async () => {
  let couponId = null;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // Create a temporary test coupon
    const coupon = await Coupon.create({
      code: `TEST${new mongoose.Types.ObjectId()
        .toString()
        .slice(0, 12)
        .toUpperCase()}`,
      discountType: "percentage",
      discountValue: 10,
      minimumPurchase: 500,
      maximumDiscount: 100,
      expiresAt: new Date("2027-12-31"),
      isActive: true,
    });

    couponId = coupon._id;

    // Run validation inside a MongoDB transaction
    const validate = async ({
      couponCode = coupon.code,
      subtotal = 1000,
      expectedDiscount = 100,
    } = {}) => {
      const session = await mongoose.startSession();

      try {
        let result;

        await session.withTransaction(async () => {
          result = await validateCouponForCheckout({
            couponCode,
            subtotal,
            expectedDiscount,
            session,
          });
        });

        return result;
      } finally {
        await session.endSession();
      }
    };

    // Test 1: Active coupon
    const activeCoupon = await validate();

    assert.ok(activeCoupon);
    console.log("PASS: Active coupon accepted");

    // Test 2: Inactive coupon
    await Coupon.findByIdAndUpdate(couponId, {
      $set: { isActive: false },
    });

    await assert.rejects(
      validate(),
      /Coupon is unavailable or has expired/
    );

    console.log("PASS: Inactive coupon rejected");

    // Reactivate coupon
    await Coupon.findByIdAndUpdate(couponId, {
      $set: { isActive: true },
    });

    // Test 3: Expired coupon
    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        expiresAt: new Date("2025-01-01"),
      },
    });

    await assert.rejects(
      validate(),
      /Coupon is unavailable or has expired/
    );

    console.log("PASS: Expired coupon rejected");

    // Restore expiry date
    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        expiresAt: new Date("2027-12-31"),
      },
    });

    // Test 4: Changed discount
    await Coupon.findByIdAndUpdate(couponId, {
      $set: { maximumDiscount: 50 },
    });

    await assert.rejects(
      validate(),
      /Coupon discount changed/
    );

    console.log("PASS: Changed discount rejected");

    // Test 5: No coupon, no discount
    const noCoupon = await validate({
      couponCode: null,
      expectedDiscount: 0,
    });

    assert.equal(noCoupon, null);

    console.log("PASS: No coupon with zero discount");

    console.log(
      "\nAll checkout coupon validation tests passed!"
    );
  } finally {
    if (couponId) {
      await Coupon.deleteOne({ _id: couponId });
    }

    await mongoose.disconnect();
  }
};

runTest().catch((error) => {
  console.error("Coupon validation test failed:", error);
  process.exitCode = 1;
});
