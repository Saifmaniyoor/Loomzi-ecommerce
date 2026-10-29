
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const StoreSettings = require("../models/StoreSettings");

const findCartByUser = async (userId) => {
  return Cart.findOne({ user: userId });
};

const findCartWithProducts = async (userId) => {
  return Cart.findOne({ user: userId })
    .populate("items.product");
};

const createCart = async (userId) => {
  return Cart.create({
    user: userId,
    items: [],
  });
};

const saveCart = async (cart) => {
  return cart.save();
};

const findProductById = async (productId) => {
  return Product.findById(productId).populate("category");
};

const findShippingSettings = async () => {
  return StoreSettings.findOne({ key: "global" });
};

// Compare cart items without depending on their order.
const createCartItemSignature = (items) => {
  return items
    .map((item) => {
      const productId = String(item.productId || item.product);
      const variantId = item.variantId
        ? String(item.variantId)
        : "";
      const quantity = Number(item.quantity);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        throw new Error("Invalid cart item");
      }

      return `${productId}:${variantId}:${quantity}`;
    })
    .sort();
};

// Must be called from an existing MongoDB transaction.
const consumeCartForCheckout = async ({
  userId,
  expectedItems,
  session,
}) => {
  if (!session) {
    throw new Error("Checkout transaction session is required");
  }

  if (!Array.isArray(expectedItems) || !expectedItems.length) {
    throw new Error("Checkout items are required");
  }

  const cart = await Cart.findOne({ user: userId }).session(session);

  if (!cart || !cart.items.length) {
    throw new Error("Cart is empty or already checked out");
  }

  const currentSignature = createCartItemSignature(cart.items);
  const expectedSignature = createCartItemSignature(expectedItems);

  if (
    currentSignature.length !== expectedSignature.length ||
    currentSignature.some(
      (item, index) => item !== expectedSignature[index]
    )
  ) {
    throw new Error(
      "Your cart changed during checkout. Please review your cart."
    );
  }

  // Conditional write protects against concurrent cart updates.
  const result = await Cart.updateOne(
  {
    _id: cart._id,
    user: userId,
    __v: cart.__v,
  },
  {
    $set: {
      items: [],
    },
    $inc: {
      __v: 1,
    },
    $currentDate: {
      updatedAt: true,
    },
  },
  { session }
);

  if (result.matchedCount !== 1) {
    throw new Error(
      "Your cart changed during checkout. Please review your cart."
    );
  }

  return true;
};

module.exports = {
  findCartByUser,
  findCartWithProducts,
  createCart,
  saveCart,
  findProductById,
  findShippingSettings,
  consumeCartForCheckout,
};
