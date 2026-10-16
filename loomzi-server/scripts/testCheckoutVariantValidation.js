
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

    const category = await Category.create({
      name: `Variant Test ${new mongoose.Types.ObjectId()}`,
      isListed: true,
    });

    categoryId = category._id;

    const product = await Product.create({
      name: "Variant Checkout Test",
      description: "Temporary variant test product",
      category: categoryId,
      price: 500,
      sizeType: "standard",
      variants: [
        {
          color: "Red",
          size: "S",
          price: 500,
          stock: 10,
        },
        {
          color: "Blue",
          size: "M",
          price: 650,
          stock: 5,
        },
      ],
      stock: 0,
      isListed: true,
    });

    productId = product._id;

    const redVariantId = product.variants[0]._id;
    const blueVariantId = product.variants[1]._id;

    const reserve = async ({
      variantId,
      expectedPrice,
      quantity,
    }) => {
      const session = await mongoose.startSession();

      try {
        let result;

        await session.withTransaction(async () => {
          result = await reserveStock({
            productId,
            variantId,
            quantity,
            expectedPrice,
            session,
          });
        });

        return result;
      } finally {
        await session.endSession();
      }
    };

    // Test 1: Incorrect variant price
    const wrongPrice = await reserve({
      variantId: redVariantId,
      expectedPrice: 650,
      quantity: 2,
    });

    assert.equal(wrongPrice, null);

    console.log("PASS: Incorrect variant price rejected");

    // Test 2: Correct Red variant price
    const correctPrice = await reserve({
      variantId: redVariantId,
      expectedPrice: 500,
      quantity: 2,
    });

    assert.ok(correctPrice);

    console.log("PASS: Correct variant price accepted");

    // Test 3: Verify only Red stock changed
    let updatedProduct = await Product.findById(productId);

    assert.equal(updatedProduct.variants[0].stock, 8);
    assert.equal(updatedProduct.variants[1].stock, 5);

    console.log("PASS: Only selected variant stock reduced");

    // Test 4: Insufficient stock
    const insufficientStock = await reserve({
      variantId: blueVariantId,
      expectedPrice: 650,
      quantity: 6,
    });

    assert.equal(insufficientStock, null);

    updatedProduct = await Product.findById(productId);

    assert.equal(updatedProduct.variants[1].stock, 5);

    console.log("PASS: Insufficient variant stock rejected");

    // Test 5: Variant using base product price
    await Product.updateOne(
      { _id: productId, "variants._id": blueVariantId },
      { $unset: { "variants.$.price": "" } }
    );

    const fallbackPrice = await reserve({
      variantId: blueVariantId,
      expectedPrice: 500,
      quantity: 1,
    });

    assert.ok(fallbackPrice);

    updatedProduct = await Product.findById(productId);

    assert.equal(updatedProduct.variants[1].stock, 4);

    console.log("PASS: Variant base-price fallback accepted");
    console.log("All variant checkout tests passed");
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
  console.error("Variant checkout test failed:", error);
  process.exitCode = 1;
});
