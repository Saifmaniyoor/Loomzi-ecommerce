const mongoose = require("mongoose");

const {
  getListedProducts,
  getListedProductById,
} = require("../services/customerProductServices");

const getProducts = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const categoryId = req.query.category || "";

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "Invalid pagination values.",
      });
    }

    if (categoryId && !mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({
        message: "Invalid category ID.",
      });
    }

    const result = await getListedProducts(
      search,
      page,
      limit,
      categoryId
    );

    return res.status(200).json({
      message: "Products fetched successfully",
      ...result,
    });
  } catch (error) {
    console.error("Customer products error:", error);

    return res.status(500).json({
      message: "Failed to fetch products.",
    });
  }
};

const getProductDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid product ID.",
      });
    }

    const product = await getListedProductById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      message: "Product details fetched successfully",
      product,
    });
  } catch (error) {
    console.error("Customer product details error:", error);

    return res.status(500).json({
      message: "Failed to fetch product details.",
    });
  }
};

module.exports = {
  getProducts,
  getProductDetails,
};