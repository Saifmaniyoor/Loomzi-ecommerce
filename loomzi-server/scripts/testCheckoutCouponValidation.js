
require("dotenv").config();

const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Coupon = require("../models/Coupon");

const {
  validateCouponForCheckout,
} = require("../services/couponValidationServices");

const runTest = async () => {
  let couponId = null;

  try {
    // =====================================
    // 1. VERIFY TEST DATABASE CONFIGURATION
    // =====================================

    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGO_URI is missing from your .env file"
      );
    }

    if (process.env.ALLOW_COUPON_TEST_WRITES !== "true") {
      throw new Error(
        "Set ALLOW_COUPON_TEST_WRITES=true to run database tests"
      );
    }

    // Require a dedicated test database.
    // Do not run against the production Loomzi database.
    const parsedUri = new URL(mongoUri);
    const databaseName = decodeURIComponent(
      parsedUri.pathname.replace(/^\//, "")
    );

    if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
      throw new Error(
        "MONGO_URI must explicitly specify a test database, e.g. loomzi_test"
      );
    }

    await mongoose.connect(mongoUri);

    if (mongoose.connection.db.databaseName !== databaseName) {
      throw new Error(
        "Connected database does not match the expected test database"
      );
    }

    console.log("MongoDB test database connected");

    // =====================================
    // 2. CREATE TEMPORARY TEST COUPON
    // =====================================

    const futureDate = () =>
      new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      );

    const coupon = await Coupon.create({
      code: `TEST${new mongoose.Types.ObjectId()
        .toString()
        .slice(0, 12)
        .toUpperCase()}`,
      discountType: "percentage",
      discountValue: 10,
      minimumPurchase: 500,
      maximumDiscount: 100,
      expiresAt: futureDate(),
      isActive: true,
      isArchived: false,
      archivedAt: null,
    });

    couponId = coupon._id;

    // =====================================
    // 3. VALIDATION HELPER
    // =====================================

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

    // =====================================
    // TEST 1: ACTIVE COUPON
    // =====================================

    const activeCoupon = await validate();

    assert.ok(activeCoupon);

    console.log("PASS: Active coupon accepted");

    // =====================================
    // TEST 2: INACTIVE COUPON
    // =====================================

    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        isActive: false,
      },
    });

    await assert.rejects(
      validate(),
      /Coupon is unavailable or has expired/
    );

    console.log("PASS: Inactive coupon rejected");

    // Reactivate coupon
    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        isActive: true,
      },
    });

    // =====================================
    // TEST 3: EXPIRED COUPON
    // =====================================

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

    // Restore future expiry date
    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        expiresAt: futureDate(),
      },
    });

    // =====================================
    // TEST 4: CHANGED DISCOUNT
    // =====================================

    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        maximumDiscount: 50,
      },
    });

    await assert.rejects(
      validate(),
      /Coupon discount changed/
    );

    console.log("PASS: Changed discount rejected");

    // =====================================
    // TEST 5: NO COUPON
    // =====================================

    const noCoupon = await validate({
      couponCode: null,
      expectedDiscount: 0,
    });

    assert.equal(noCoupon, null);

    console.log("PASS: No coupon with zero discount");

    // =====================================
    // TEST 6: ARCHIVED COUPON
    // =====================================

    // Keep isActive=true deliberately.
    // This verifies archive protection works
    // independently of the active status.
    await Coupon.findByIdAndUpdate(couponId, {
      $set: {
        isActive: true,
        isArchived: true,
        archivedAt: new Date(),
        maximumDiscount: 100,
      },
    });

    await assert.rejects(
      validate(),
      /Coupon is unavailable or has expired/
    );

    console.log("PASS: Archived coupon rejected");

    console.log(
      "\nAll checkout coupon validation tests passed!"
    );
  } finally {
    // =====================================
    // CLEAN UP TEMPORARY TEST DATA
    // =====================================

    try {
      if (couponId && mongoose.connection.readyState === 1) {
        await Coupon.deleteOne({
          _id: couponId,
        });

        console.log("Temporary test coupon removed");
      }
    } finally {
      await mongoose.disconnect();
    }
  }
};

runTest().catch((error) => {
  console.error(
    "Coupon validation test failed:",
    error
  );

  process.exitCode = 1;
});
