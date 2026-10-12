const express = require("express");
const router = express.Router();

const {
  addCategory,
  getCategories,
  editCategory,
  changeCategoryStatus,
} = require("../controllers/categoryController");

const requireAdmin = require("../middleware/requireAdmin");

// Protect all category routes
router.use(requireAdmin);

// Add category
router.post("/", addCategory);

// Get all categories with search and pagination
router.get("/", getCategories);

// Edit category
router.patch("/:id", editCategory);

// List or unlist category
router.patch("/:id/:action", changeCategoryStatus);

module.exports = router;