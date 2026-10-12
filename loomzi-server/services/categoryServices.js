const Category = require("../models/Category");

// Create a new category
const createCategory = async (categoryData) => {
  return await Category.create(categoryData);
};

// Find a category by ID
const findCategoryById = async (categoryId) => {
  return await Category.findById(categoryId);
};

// Find a category by name
const findCategoryByName = async (name) => {
  return await Category.findOne({
    name: {
      $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  });
};

// Get categories with search and pagination
const getAllCategories = async (search, page, limit) => {
  const query = {};

  if (search) {
    query.name = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  }

  const skip = (page - 1) * limit;

  const [categories, totalCategories] = await Promise.all([
    Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),

    Category.countDocuments(query),
  ]);

  return {
    categories,
    totalCategories,
    currentPage: page,
    totalPages: Math.ceil(totalCategories / limit),
  };
};

// Update category details
const updateCategory = async (categoryId, updateData) => {
  return await Category.findByIdAndUpdate(
    categoryId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  );
};

// Update category listing status
const updateCategoryListingStatus = async (categoryId, isListed) => {
  return await Category.findByIdAndUpdate(
    categoryId,
    { $set: { isListed } },
    {
      new: true,
      runValidators: true,
    }
  );
};

module.exports = {
  createCategory,
  findCategoryById,
  findCategoryByName,
  getAllCategories,
  updateCategory,
  updateCategoryListingStatus,
};