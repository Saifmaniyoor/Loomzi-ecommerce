
const mongoose = require("mongoose");
const productServices = require("../services/productServices");

// ==========================================
// 1. AVAILABLE SIZES
// ==========================================

const AGE_SIZES = [
  "0-3 months",
  "3-6 months",
  "6-12 months",
  "1-2 years",
  "2-3 years",
  "3-4 years",
  "4-5 years",
  "5-6 years",
  "6-7 years",
  "7-8 years",
  "8-9 years",
  "9-10 years",
  "10-11 years",
  "11-12 years",
];

const STANDARD_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
];

// ==========================================
// 2. VALIDATE PRODUCT DATA
// ==========================================

const validateProductData = (data) => {
  const {
    name,
    description,
    category,
    price,
    images,
    sizeType,
    variants,
    stock,
  } = data;

  // Product name
  if (typeof name !== "string" || !name.trim()) {
    return "Product name is required";
  }

  // Description
  if (
    typeof description !== "string" ||
    !description.trim()
  ) {
    return "Product description is required";
  }

  // Category
  if (!mongoose.isValidObjectId(category)) {
    return "Invalid category ID";
  }

  // Base price
  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return "Price must be a valid non-negative number";
  }

  // Images
  if (
    !Array.isArray(images) ||
    images.some(
      (image) =>
        typeof image !== "string" || !image.trim()
    )
  ) {
    return "Images must be an array of nonempty strings";
  }

  // Size type
  if (!["age", "standard", "none"].includes(sizeType)) {
    return "Invalid size type";
  }

  // Variants
  if (!Array.isArray(variants)) {
    return "Variants must be an array";
  }

  const allowedSizes =
    sizeType === "age" ? AGE_SIZES : STANDARD_SIZES;

  const usedCombinations = new Set();

  for (const variant of variants) {
    if (
      !variant ||
      typeof variant !== "object" ||
      Array.isArray(variant)
    ) {
      return "Each variant must be an object";
    }

    // Existing products may not have a color.
    const color =
      typeof variant.color === "string"
        ? variant.color.trim()
        : "";

    const size =
      typeof variant.size === "string"
        ? variant.size.trim()
        : "";

    // Validate size
    if (sizeType !== "none") {
      if (!allowedSizes.includes(size)) {
        return `Invalid size: ${size}`;
      }
    } else if (size !== "") {
      return "Products without sizes cannot have variant sizes";
    }

    // Validate stock
    if (
      !Number.isInteger(variant.stock) ||
      variant.stock < 0
    ) {
      return "Variant stock must be a non-negative integer";
    }

    // Optional variant price
    if (
      variant.price !== undefined &&
      (
        typeof variant.price !== "number" ||
        !Number.isFinite(variant.price) ||
        variant.price < 0
      )
    ) {
      return "Variant price must be a valid non-negative number";
    }

    // Optional SKU
    if (
      variant.sku !== undefined &&
      typeof variant.sku !== "string"
    ) {
      return "SKU must be a string";
    }

    // If color is provided, it must be valid.
    if (
      variant.color !== undefined &&
      (
        typeof variant.color !== "string" ||
        !color
      )
    ) {
      return "Variant color must be a nonempty string";
    }

    // Prevent duplicate color + size combinations.
    const combination = JSON.stringify([
      color.toLowerCase(),
      size.toLowerCase(),
    ]);

    if (usedCombinations.has(combination)) {
      return "Duplicate color and size combination";
    }

    usedCombinations.add(combination);
  }

  // Sized products require at least one variant.
  if (sizeType !== "none" && variants.length === 0) {
    return "Please add at least one size variant";
  }

  // Validate main stock
  if (!Number.isInteger(stock) || stock < 0) {
    return "Stock must be a non-negative integer";
  }

  // If variants exist, inventory belongs to variants.
  if (variants.length > 0 && stock !== 0) {
    return "Main stock must be 0 when variants are used";
  }

  if (sizeType !== "none" && stock !== 0) {
    return "Sized products must use variant stock";
  }

  return null;
};

// ==========================================
// 3. NORMALIZE VARIANTS
// ==========================================

const normalizeVariants = (variants) => {
  return variants.map((variant) => ({
    ...variant,
    color:
      typeof variant.color === "string"
        ? variant.color.trim()
        : "Default",
    size:
      typeof variant.size === "string"
        ? variant.size.trim()
        : "",
    ...(typeof variant.sku === "string"
      ? { sku: variant.sku.trim() }
      : {}),
  }));
};

// ==========================================
// 4. ADD PRODUCT
// POST /api/admin/products
// ==========================================

const addProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      images = [],
      sizeType,
      variants = [],
      stock = 0,
    } = req.body;

    const productData = {
      name,
      description,
      category,
      price,
      images,
      sizeType,
      variants,
      stock,
    };

    const validationError =
      validateProductData(productData);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    // Verify category
    const existingCategory =
      await productServices.findCategoryById(category);

    if (!existingCategory) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    if (!existingCategory.isListed) {
      return res.status(400).json({
        message: "Cannot add product to an unlisted category",
      });
    }

    productData.name = name.trim();
    productData.description = description.trim();
    productData.images = images.map((image) =>
      image.trim()
    );

    productData.variants = normalizeVariants(variants);

    const product =
      await productServices.createProduct(productData);

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Add product error:", error);

    return res.status(500).json({
      message: "Failed to create product",
    });
  }
};

// ==========================================
// 5. GET ALL PRODUCTS
// GET /api/admin/products
// ==========================================

const getProducts = async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message:
          "Page must be at least 1 and limit must be between 1 and 100",
      });
    }

    const result = await productServices.getAllProducts(
      search,
      page,
      limit
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      message: "Failed to fetch products",
    });
  }
};

// ==========================================
// 6. GET SINGLE PRODUCT
// GET /api/admin/products/:id
// ==========================================

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product =
      await productServices.findProductById(id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.status(200).json({
      product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    return res.status(500).json({
      message: "Failed to fetch product",
    });
  }
};

// ==========================================
// 7. EDIT PRODUCT
// PATCH /api/admin/products/:id
// ==========================================

const editProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const existingProduct =
      await productServices.findProductById(id);

    if (!existingProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "price",
      "images",
      "sizeType",
      "variants",
      "stock",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided for update",
      });
    }

    // The category may be populated by Mongoose.
    const existingData = existingProduct.toObject();

    const mergedData = {
      ...existingData,
      category:
        updateData.category ??
        existingProduct.category?._id ??
        existingProduct.category,
      ...updateData,
    };

    const validationError =
      validateProductData(mergedData);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    // Check category when it is changed.
    if (updateData.category !== undefined) {
      const category =
        await productServices.findCategoryById(
          updateData.category
        );

      if (!category) {
        return res.status(404).json({
          message: "Category not found",
        });
      }

      if (!category.isListed) {
        return res.status(400).json({
          message:
            "Cannot assign an unlisted category",
        });
      }
    }

    if (typeof updateData.name === "string") {
      updateData.name = updateData.name.trim();
    }

    if (typeof updateData.description === "string") {
      updateData.description =
        updateData.description.trim();
    }

    if (Array.isArray(updateData.images)) {
      updateData.images = updateData.images.map(
        (image) => image.trim()
      );
    }

    if (Array.isArray(updateData.variants)) {
      updateData.variants = normalizeVariants(
        updateData.variants
      );
    }

    const product =
      await productServices.updateProduct(
        id,
        updateData
      );

    return res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Edit product error:", error);

    return res.status(500).json({
      message: "Failed to update product",
    });
  }
};

// ==========================================
// 8. LIST / UNLIST PRODUCT
// PATCH /api/admin/products/:id/:action
// ==========================================

const changeProductStatus = async (req, res) => {
  try {
    const { id, action } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    if (!["list", "unlist"].includes(action)) {
      return res.status(400).json({
        message: "Invalid action. Use list or unlist",
      });
    }

    const existingProduct =
      await productServices.findProductById(id);

    if (!existingProduct) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const isListed = action === "list";

    if (isListed) {
      const categoryId =
        existingProduct.category?._id ??
        existingProduct.category;

      const category =
        await productServices.findCategoryById(
          categoryId
        );

      if (!category || !category.isListed) {
        return res.status(400).json({
          message:
            "Cannot list product because its category is unavailable or unlisted",
        });
      }
    }

    const product =
      await productServices.updateProductListingStatus(
        id,
        isListed
      );

    return res.status(200).json({
      message: isListed
        ? "Product listed successfully"
        : "Product unlisted successfully",
      product,
    });
  } catch (error) {
    console.error("Change product status error:", error);

    return res.status(500).json({
      message: "Failed to update product status",
    });
  }
};

// ==========================================
// 9. EXPORT CONTROLLERS
// ==========================================

module.exports = {
  addProduct,
  getProducts,
  getProductById,
  editProduct,
  changeProductStatus,
};
