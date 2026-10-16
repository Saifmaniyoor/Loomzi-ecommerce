
const mongoose = require("mongoose");

const cartServices = require("../services/cartServices");

const {
  getProductAvailability,
  calculateCartSummary,
} = require("../utils/cartCalculator");

// Validate MongoDB ObjectId
const isValidId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Get logged-in customer ID
const getUserId = (req) => {
  return req.user?._id || req.session?.userId;
};

// GET /api/cart
const getCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const cartSummary = await calculateCartSummary(userId);

    return res.status(200).json({
      message: "Cart fetched successfully",
      cart: cartSummary,
    });
  } catch (error) {
    console.error("Get cart error:", error);

    return res.status(500).json({
      message: "Failed to fetch cart",
    });
  }
};

// POST /api/cart/items
const addToCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const {
      productId,
      variantId = null,
      quantity = 1,
    } = req.body || {};

    if (!isValidId(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    if (
      variantId !== null &&
      !isValidId(variantId)
    ) {
      return res.status(400).json({
        message: "Invalid variant ID",
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        message: "Quantity must be a positive integer",
      });
    }

    const product = await cartServices.findProductById(
      productId
    );

    const availability = getProductAvailability(
      product,
      variantId
    );

    if (availability.error) {
      return res.status(400).json({
        message: availability.error,
      });
    }

    if (
      !Number.isFinite(availability.price) ||
      availability.price < 0
    ) {
      return res.status(400).json({
        message: "Invalid product price",
      });
    }

    let cart = await cartServices.findCartByUser(userId);

    if (!cart) {
      cart = await cartServices.createCart(userId);
    }

    const existingItem = cart.items.find(
      (item) =>
        String(item.product) === String(productId) &&
        String(item.variantId || "") ===
          String(variantId || "")
    );

    const newQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    if (newQuantity > availability.stock) {
      return res.status(400).json({
        message: `Only ${availability.stock} items available`,
      });
    }

    if (existingItem) {
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({
        product: productId,
        variantId,
        quantity,
      });
    }

    await cartServices.saveCart(cart);

    return res.status(200).json({
      message: "Product added to cart successfully",
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    return res.status(500).json({
      message: "Failed to add product to cart",
    });
  }
};

// PATCH /api/cart/items/:itemId
const updateCartItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemId } = req.params;
    const { quantity } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    if (!isValidId(itemId)) {
      return res.status(400).json({
        message: "Invalid cart item ID",
      });
    }

    if (
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({
        message: "Quantity must be a positive integer",
      });
    }

    const cart = await cartServices.findCartByUser(userId);

    const item = cart?.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        message: "Cart item not found",
      });
    }

    const product = await cartServices.findProductById(
      item.product
    );

    const availability = getProductAvailability(
      product,
      item.variantId
    );

    if (availability.error) {
      return res.status(400).json({
        message: availability.error,
      });
    }

    if (
      !Number.isFinite(availability.price) ||
      availability.price < 0
    ) {
      return res.status(400).json({
        message: "Invalid product price",
      });
    }

    if (quantity > availability.stock) {
      return res.status(400).json({
        message: `Only ${availability.stock} items available`,
      });
    }

    item.quantity = quantity;

    await cartServices.saveCart(cart);

    return res.status(200).json({
      message: "Cart quantity updated successfully",
    });
  } catch (error) {
    console.error("Update cart error:", error);

    return res.status(500).json({
      message: "Failed to update cart item",
    });
  }
};

// DELETE /api/cart/items/:itemId
const removeCartItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { itemId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    if (!isValidId(itemId)) {
      return res.status(400).json({
        message: "Invalid cart item ID",
      });
    }

    const cart = await cartServices.findCartByUser(userId);

    const item = cart?.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        message: "Cart item not found",
      });
    }

    cart.items.pull({ _id: itemId });

    await cartServices.saveCart(cart);

    return res.status(200).json({
      message: "Product removed from cart",
    });
  } catch (error) {
    console.error("Remove cart error:", error);

    return res.status(500).json({
      message: "Failed to remove cart item",
    });
  }
};

// DELETE /api/cart
const clearCart = async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const cart = await cartServices.findCartByUser(userId);

    if (cart) {
      cart.items = [];

      await cartServices.saveCart(cart);
    }

    return res.status(200).json({
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Clear cart error:", error);

    return res.status(500).json({
      message: "Failed to clear cart",
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
