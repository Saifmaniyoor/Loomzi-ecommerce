const express = require("express");

const {
  getProducts,
  getProductDetails,
} = require("../controllers/customerProductController");

const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getProductDetails);

module.exports = router;