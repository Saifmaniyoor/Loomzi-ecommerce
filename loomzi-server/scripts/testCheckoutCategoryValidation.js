
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Category = require("../models/Category");

const {
  validateCategoryForCheckout,
} = require("../services/categoryReservationServices");

const runTest = async () => {
  let categoryId = null;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const category = await Category.create({
      name: `Checkout Category Test ${new mongoose.Types.ObjectId()}`,
      isListed: true,
    });

    categoryId = category._id;

    // Helper to run category validation in a transaction.
    const validate = async () => {
      const session = await mongoose.startSession();

      try {
        let result;

        await session.withTransaction(async () => {
          result = await validateCategoryForCheckout({
            categoryId,
            session,
          });
        });

        return result;
      } finally {
        await session.endSession();
      }
    };

    // Test 1: Listed category should pass.
    const listedCategory = await validate();

    assert.ok(listedCategory);
    assert.equal(listedCategory.isListed, true);

    console.log("PASS: Listed category accepted");

    // Test 2: Admin unlists the category.
    await Category.findByIdAndUpdate(categoryId, {
      $set: { isListed: false },
    });

    // Test 3: Unlisted category should fail.
    await assert.rejects(
      validate(),
      /Product category is unavailable/
    );

    console.log("PASS: Unlisted category rejected");

    // Test 4: Admin lists the category again.
    await Category.findByIdAndUpdate(categoryId, {
      $set: { isListed: true },
    });

    const relistedCategory = await validate();

    assert.ok(relistedCategory);
    assert.equal(relistedCategory.isListed, true);

    console.log("PASS: Relisted category accepted");
    console.log("All category checkout tests passed");
  } finally {
    if (categoryId) {
      await Category.deleteOne({ _id: categoryId });
    }

    await mongoose.disconnect();
  }
};

runTest().catch((error) => {
  console.error("Category checkout test failed:", error);
  process.exitCode = 1;
});
