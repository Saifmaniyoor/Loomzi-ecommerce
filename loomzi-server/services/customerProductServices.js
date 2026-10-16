const Product = require("../models/Product");
const Category = require("../models/Category");

const getListedProducts = async (search, page, limit, categoryId) => {
  const listedCategories = await Category.find({
    isListed: true,
  }).select("_id");

  const categoryIds = listedCategories.map((category) => category._id);

  const query = {
    isListed: true,
    category: { $in: categoryIds },
  };

  if (categoryId) {
    query.category = {
      $in: categoryIds.filter(
        (id) => id.toString() === categoryId
      ),
    };
  }

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.name = {
      $regex: safeSearch,
      $options: "i",
    };
  }

  const skip = (page - 1) * limit;

  const [products, totalProducts] = await Promise.all([
    Product.find(query)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Product.countDocuments(query),
  ]);

  return {
    products,
    totalProducts,
    currentPage: page,
    totalPages: Math.ceil(totalProducts / limit),
  };
};

const getListedProductById = async (productId) => {
  const product = await Product.findOne({
    _id: productId,
    isListed: true,
  })
    .populate("category", "name isListed")
    .lean();

  if (!product || !product.category?.isListed) {
    return null;
  }

  return product;
};

module.exports = {
  getListedProducts,
  getListedProductById,
};