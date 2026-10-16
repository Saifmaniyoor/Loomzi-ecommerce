
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const StoreSettings = require("../models/StoreSettings");

const {
  validateShippingForCheckout,
} = require("../services/shippingValidationServices");

const runTest = async () => {
  let originalSettings = null;
  let createdSettings = false;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // Save existing settings for restoration.
    const existing = await StoreSettings.findOne({
      key: "global",
    });

    if (existing) {
      originalSettings = existing.shippingCharge;
    } else {
      await StoreSettings.create({
        key: "global",
        shippingCharge: 50,
      });

      createdSettings = true;
    }

    // Run validation inside a transaction.
    const validate = async (expectedShippingCharge) => {
      const session = await mongoose.startSession();

      try {
        let result;

        await session.withTransaction(async () => {
          result = await validateShippingForCheckout({
            expectedShippingCharge,
            session,
          });
        });

        return result;
      } finally {
        await session.endSession();
      }
    };

    // Test 1: Matching ₹50 shipping
    await StoreSettings.updateOne(
      { key: "global" },
      { $set: { shippingCharge: 50 } }
    );

    assert.equal(await validate(50), 50);
    console.log("PASS: ₹50 shipping accepted");

    // Test 2: Shipping changed to ₹80
    await StoreSettings.updateOne(
      { key: "global" },
      { $set: { shippingCharge: 80 } }
    );

    await assert.rejects(
      validate(50),
      /Shipping charge changed/
    );

    console.log("PASS: Outdated ₹50 shipping rejected");

    // Test 3: Free shipping
    await StoreSettings.updateOne(
      { key: "global" },
      { $set: { shippingCharge: 0 } }
    );

    assert.equal(await validate(0), 0);
    console.log("PASS: Free shipping accepted");

    // Test 4: Incorrect shipping amount
    await assert.rejects(
      validate(50),
      /Shipping charge changed/
    );

    console.log("PASS: Incorrect shipping rejected");

    console.log(
      "\nAll shipping validation tests passed!"
    );
  } finally {
    // Restore the original shipping configuration.
    if (createdSettings) {
      await StoreSettings.deleteOne({ key: "global" });
    } else if (originalSettings !== null) {
      await StoreSettings.updateOne(
        { key: "global" },
        { $set: { shippingCharge: originalSettings } }
      );
    }

    await mongoose.disconnect();
  }
};

runTest().catch((error) => {
  console.error("Shipping validation test failed:", error);
  process.exitCode = 1;
});
