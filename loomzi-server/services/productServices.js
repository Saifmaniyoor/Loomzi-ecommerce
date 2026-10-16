const Product = require("../models/Product");
const Category = require("../models/Category");

// 1. Find category by ID
const findCategoryById = async (categoryId) => {
  return await Category.findById(categoryId);
};

// 2. Create product
const createProduct = async (productData) => {
  return await Product.create(productData);
};

// 3. Get all products with search and pagination
const getAllProducts = async (search, page, limit) => {
  const query = {};

  if (search) {
    const safeSearch = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    query.name = {
      $regex: safeSearch,
      $options: "i",
    };
  }

  const skip = (page - 1) * limit;

  const [products, totalProducts] = await Promise.all([
    Product.find(query)
      .populate("category", "name isListed")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Product.countDocuments(query),
  ]);

  return {
    products,
    totalProducts,
    currentPage: page,
    totalPages: Math.ceil(totalProducts / limit),
  };
};

// 4. Find product by ID
const findProductById = async (productId) => {
  return await Product.findById(productId).populate(
    "category",
    "name isListed"
  );
};

// 5. Update product
const updateProduct = async (productId, updateData) => {
  return await Product.findByIdAndUpdate(
    productId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  );
};

// 6. List or unlist product
const updateProductListingStatus = async (productId, isListed) => {
  return await Product.findByIdAndUpdate(
    productId,
    {
      $set: { isListed },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

module.exports = {
  findCategoryById,
  createProduct,
  getAllProducts,
  findProductById,
  updateProduct,
  updateProductListingStatus,
};