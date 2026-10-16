const express = require("express");
const router = express.Router();

const {
  addProduct,
  getProducts,
  getProductById,
  editProduct,
  changeProductStatus,
} = require("../controllers/productController");

const requireAdmin = require("../middleware/requireAdmin");

// Protect all product management routes
router.use(requireAdmin);

// Add a product
router.post("/", addProduct);

// Get products with search and pagination
router.get("/", getProducts);

// Get a single product
router.get("/:id", getProductById);

// Edit a product
router.patch("/:id", editProduct);

// List or unlist a product
router.patch("/:id/:action", changeProductStatus);

module.exports = router;