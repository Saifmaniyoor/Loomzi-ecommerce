
const express = require("express");
const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  validateCoupon,
} = require("../controllers/couponController");

router.use(requireUser);

router.post("/validate", validateCoupon);

module.exports = router;
