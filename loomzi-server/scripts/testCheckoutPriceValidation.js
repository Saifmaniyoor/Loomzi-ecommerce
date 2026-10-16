
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const Category = require("../models/Category");

const {
  reserveStock,
} = require("../services/inventoryServices");

const runTest = async () => {
  let productId = null;
  let categoryId = null;

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // Create temporary test category
    const category = await Category.create({
      name: `Checkout Test ${Date.now()}`,
      isListed: true,
    });

    categoryId = category._id;

    // Create temporary test product
    const product = await Product.create({
      name: "Checkout Price Test Product",
      description: "Temporary checkout test product",
      category: categoryId,
      price: 500,
      sizeType: "none",
      variants: [],
      stock: 10,
      isListed: true,
    });

    productId = product._id;

    // Test 1: Wrong price must fail
    const session1 = await mongoose.startSession();

    try {
      await session1.withTransaction(async () => {
        const result = await reserveStock({
          productId,
          variantId: null,
          quantity: 2,
          expectedPrice: 400,
          session: session1,
        });

        assert.equal(result, null);
      });
    } finally {
      await session1.endSession();
    }

    let updatedProduct = await Product.findById(productId);

    assert.equal(updatedProduct.stock, 10);

    console.log("PASS: Wrong price rejected");

    // Test 2: Correct price must succeed
    const session2 = await mongoose.startSession();

    try {
      await session2.withTransaction(async () => {
        const result = await reserveStock({
          productId,
          variantId: null,
          quantity: 2,
          expectedPrice: 500,
          session: session2,
        });

        assert.ok(result);
      });
    } finally {
      await session2.endSession();
    }

    updatedProduct = await Product.findById(productId);

    assert.equal(updatedProduct.stock, 8);

    console.log("PASS: Correct price accepted");
    console.log("PASS: Stock reduced from 10 to 8");
    console.log("All checkout price tests passed");
  } finally {
    if (productId) {
      await Product.deleteOne({ _id: productId });
    }

    if (categoryId) {
      await Category.deleteOne({ _id: categoryId });
    }

    await mongoose.disconnect();
  }
};

runTest().catch((error) => {
  console.error("Checkout price test failed:", error);
  process.exitCode = 1;
});
