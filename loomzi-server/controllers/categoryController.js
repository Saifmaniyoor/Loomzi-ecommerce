const mongoose = require("mongoose");
const categoryServices = require("../services/categoryServices");

// 1. Add Category
const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({
        message: "Description must be a string",
      });
    }

    const normalizedName = name.trim();

    const existingCategory =
      await categoryServices.findCategoryByName(normalizedName);

    if (existingCategory) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    const category = await categoryServices.createCategory({
      name: normalizedName,
      description: description?.trim() || "",
    });

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    console.error("Add category error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// 2. Get All Categories
const getCategories = async (req, res) => {
  try {
    const { search = "" } = req.query;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    if (
      typeof search !== "string" ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "Invalid search or pagination parameters",
      });
    }

    const result = await categoryServices.getAllCategories(
      search.trim(),
      page,
      limit,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get categories error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// 3. Edit Category
const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        message: "Provide a name or description to update",
      });
    }

    const updateData = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Valid category name is required",
        });
      }

      const normalizedName = name.trim();

      const existingCategory =
        await categoryServices.findCategoryByName(normalizedName);

      if (existingCategory && existingCategory._id.toString() !== id) {
        return res.status(409).json({
          message: "Category name already exists",
        });
      }

      updateData.name = normalizedName;
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          message: "Description must be a string",
        });
      }

      updateData.description = description.trim();
    }

    const category = await categoryServices.updateCategory(id, updateData);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.status(200).json({
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category name already exists",
      });
    }

    console.error("Edit category error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// 4. List or Unlist Category
const changeCategoryStatus = async (req, res) => {
  try {
    const { id, action } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid category ID",
      });
    }

    if (!["list", "unlist"].includes(action)) {
      return res.status(400).json({
        message: "Invalid action. Use list or unlist",
      });
    }

    const isListed = action === "list";

    const category = await categoryServices.updateCategoryListingStatus(
      id,
      isListed,
    );

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    return res.status(200).json({
      message: isListed
        ? "Category listed successfully"
        : "Category unlisted successfully",
      category,
    });
  } catch (error) {
    console.error("Change category status error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  addCategory,
  getCategories,
  editCategory,
  changeCategoryStatus,
};
