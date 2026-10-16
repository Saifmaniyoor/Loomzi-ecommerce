
const express = require("express");

const {
  confirmPayment,
} = require("../controllers/paymentConfirmationController");

const requireUser = require("../middleware/requireUser");

const router = express.Router();

router.post(
  "/confirm",
  requireUser,
  confirmPayment
);

module.exports = router;
