const Product = require("../models/Product");
const Category = require("../models/Category");
const { loadActiveOffers, calculateOfferPrice } = require("./offerPricingServices");

const withOffer = (product, offers) => {
  const pricing = calculateOfferPrice({ productId: product._id, categoryId: product.category?._id || product.category, price: product.price, manualOfferPrice: product.offerPrice, offers });
  return { ...product, ...pricing };
};

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

  const offers = await loadActiveOffers();
  return {
    products: products.map(p => withOffer(p, offers)),
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

  const offers = await loadActiveOffers();
  return withOffer(product, offers);
};

module.exports = {
  getListedProducts,
  getListedProductById,
};