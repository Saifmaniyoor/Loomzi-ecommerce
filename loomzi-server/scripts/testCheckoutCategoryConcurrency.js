
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Category = require("../models/Category");

const {
  validateCategoryForCheckout,
} = require("../services/categoryReservationServices");

const runTest = async () => {
  let categoryId = null;
  let session = null;

  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const category = await Category.create({
      name: `Concurrency Test ${new mongoose.Types.ObjectId()}`,
      isListed: true,
    });

    categoryId = category._id;

    session = await mongoose.startSession();
    session.startTransaction();

    // 1. Checkout validates the listed category.
    const validated = await validateCategoryForCheckout({
      categoryId,
      session,
    });

    assert.ok(validated);
    console.log("PASS: Checkout validated listed category");

    // 2. Admin attempts to unlist the same category.
    // A short timeout prevents this test from hanging.
    const adminUpdate = Category.findByIdAndUpdate(
      categoryId,
      {
        $set: { isListed: false },
      },
      {
        new: true,
        maxTimeMS: 1000,
      }
    );

    let adminBlocked = false;

    try {
      await adminUpdate;
    } catch (error) {
      // A lock timeout is expected while checkout
      // holds a write on the category document.
      if (
        error.code === 50 ||
        error.codeName === "MaxTimeMSExpired"
      ) {
        adminBlocked = true;
      } else {
        throw error;
      }
    }

    assert.equal(
      adminBlocked,
      true,
      "Admin update should not complete while checkout holds the category write"
    );

    console.log(
      "PASS: Concurrent category update could not complete"
    );

    // 3. Commit checkout's category validation.
    await session.commitTransaction();

    console.log("PASS: Checkout transaction committed");

    // 4. Admin can now unlist the category.
    const updated = await Category.findByIdAndUpdate(
      categoryId,
      {
        $set: { isListed: false },
      },
      { new: true }
    );

    assert.equal(updated.isListed, false);

    console.log("PASS: Admin can update category after commit");
    console.log("All category concurrency tests passed");
  } finally {
    if (session) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      await session.endSession();
    }

    if (categoryId) {
      await Category.deleteOne({ _id: categoryId });
    }

    await mongoose.disconnect();
  }
};

runTest().catch((error) => {
  console.error("Category concurrency test failed:", error);
  process.exitCode = 1;
});
