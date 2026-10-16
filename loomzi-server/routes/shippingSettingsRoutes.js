
const express = require("express");
const router = express.Router();

// Existing Super Admin authentication middleware
const requireAdmin = require("../middleware/requireAdmin");

const {
  getShippingCharge,
  updateShippingCharge,
} = require("../controllers/shippingSettingsController");

// Protect all shipping settings routes
router.use(requireAdmin);

// GET /api/admin/settings/shipping
router.get("/", getShippingCharge);

// PATCH /api/admin/settings/shipping
router.patch("/", updateShippingCharge);

module.exports = router;
