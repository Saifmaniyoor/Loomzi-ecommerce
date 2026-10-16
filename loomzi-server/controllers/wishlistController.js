
const mongoose = require("mongoose");
const wishlistServices = require("../services/wishlistServices");

// ======================================
// GET WISHLIST
// ======================================
const getWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;

    const wishlist =
      await wishlistServices.findWishlistByUser(userId);

    const products = wishlist
      ? wishlist.products.filter(
          (product) => product && product.isListed
        )
      : [];

    return res.status(200).json({
      message: "Wishlist fetched successfully",
      products,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ======================================
// ADD PRODUCT TO WISHLIST
// ======================================
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.body || {};

    if (
      !productId ||
      !mongoose.isValidObjectId(productId)
    ) {
      return res.status(400).json({
        message: "Valid product ID is required",
      });
    }

    const product =
      await wishlistServices.findProductById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (!product.isListed) {
      return res.status(400).json({
        message: "This product is currently unavailable",
      });
    }

    await wishlistServices.addProductToWishlist(
      userId,
      productId
    );

    return res.status(200).json({
      message: "Product added to wishlist successfully",
    });
  } catch (error) {
    console.error("Add wishlist error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ======================================
// REMOVE PRODUCT FROM WISHLIST
// ======================================
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const wishlist =
      await wishlistServices.removeProductFromWishlist(
        userId,
        productId
      );

    if (!wishlist) {
      return res.status(404).json({
        message: "Wishlist not found",
      });
    }

    return res.status(200).json({
      message: "Product removed from wishlist successfully",
    });
  } catch (error) {
    console.error("Remove wishlist error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
