
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

// Get a customer's wishlist with product details
const findWishlistByUser = async (userId) => {
  return Wishlist.findOne({ user: userId }).populate({
    path: "products",
    select:
      "name description price images category isListed stock variants",
  });
};

// Find a product by ID
const findProductById = async (productId) => {
  return Product.findById(productId);
};

// Add product without creating duplicates
const addProductToWishlist = async (userId, productId) => {
  return Wishlist.findOneAndUpdate(
    { user: userId },
    {
      $addToSet: {
        products: productId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );
};

// Remove a product
const removeProductFromWishlist = async (
  userId,
  productId
) => {
  return Wishlist.findOneAndUpdate(
    { user: userId },
    {
      $pull: {
        products: productId,
      },
    },
    {
      new: true,
    }
  );
};

module.exports = {
  findWishlistByUser,
  findProductById,
  addProductToWishlist,
  removeProductFromWishlist,
};
