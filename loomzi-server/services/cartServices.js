
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

module.exports = {
  findCartByUser,
  findCartWithProducts,
  createCart,
  saveCart,
  findProductById,
  findShippingSettings,
};
