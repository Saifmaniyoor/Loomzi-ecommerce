
const mongoose = require("mongoose");
const Product = require("../models/Product");

// Reserve stock only when the current price
// matches the checkout snapshot.
const reserveStock = async ({
  productId,
  variantId,
  quantity,
  expectedPrice,
  session,
}) => {
  if (
    !mongoose.isValidObjectId(productId) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    typeof expectedPrice !== "number" ||
    !Number.isFinite(expectedPrice) ||
    expectedPrice < 0 ||
    (variantId && !mongoose.isValidObjectId(variantId))
  ) {
    throw new Error("Invalid stock reservation details");
  }

  if (!session) {
    throw new Error("Stock reservation requires a transaction");
  }

  // Product with variants
  if (variantId) {
    const selectedVariantId =
      new mongoose.Types.ObjectId(variantId);

    const variantCondition = {
      _id: selectedVariantId,
      stock: { $gte: quantity },
      $or: [
        { price: expectedPrice },
        { price: null },
      ],
    };

    // Match the effective variant price:
    // variant.price when set, otherwise product.price.
    return Product.findOneAndUpdate(
      {
        _id: productId,
        isListed: true,
        $or: [
          {
            variants: {
              $elemMatch: {
                _id: selectedVariantId,
                stock: { $gte: quantity },
                price: expectedPrice,
              },
            },
          },
          {
            price: expectedPrice,
            variants: {
              $elemMatch: {
                _id: selectedVariantId,
                stock: { $gte: quantity },
                price: null,
              },
            },
          },
        ],
      },
      {
        $inc: {
          "variants.$[selected].stock": -quantity,
        },
      },
      {
        new: true,
        session,
        arrayFilters: [
          {
            "selected._id": selectedVariantId,
            "selected.stock": { $gte: quantity },
          },
        ],
      }
    );
  }

  // Product without variants
  return Product.findOneAndUpdate(
    {
      _id: productId,
      isListed: true,
      "variants.0": { $exists: false },
      price: expectedPrice,
      stock: { $gte: quantity },
    },
    {
      $inc: {
        stock: -quantity,
      },
    },
    {
      new: true,
      session,
    }
  );
};

// Restore stock only after safe release.
const releaseStock = async ({
  productId,
  variantId,
  quantity,
  session,
}) => {
  if (variantId) {
    return Product.findOneAndUpdate(
      {
        _id: productId,
        "variants._id": variantId,
      },
      {
        $inc: {
          "variants.$.stock": quantity,
        },
      },
      {
        new: true,
        session,
      }
    );
  }

  return Product.findByIdAndUpdate(
    productId,
    {
      $inc: {
        stock: quantity,
      },
    },
    {
      new: true,
      session,
    }
  );
};

// Reserve all items in one transaction.
const reserveCartItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cannot reserve an empty cart");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const item of items) {
        const quantity = Number(item.quantity);

        const updatedProduct = await reserveStock({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity,
          expectedPrice: item.originalPrice ?? item.price,
          session,
        });

        if (!updatedProduct) {
          throw new Error(
            `Stock, price, or listing changed for ${
              item.name || "product"
            }`
          );
        }
      }
    });

    return {
      success: true,
      message: "All cart items reserved successfully",
    };
  } finally {
    await session.endSession();
  }
};

module.exports = {
  reserveStock,
  releaseStock,
  reserveCartItems,
};
