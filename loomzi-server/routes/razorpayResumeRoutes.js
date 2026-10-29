
const express = require("express");
const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  resumeRazorpayCheckout,
} = require("../controllers/razorpayResumeController");

router.post(
  "/razorpay/resume/:orderId",
  (req, res, next) => {
    console.log("RESUME ROUTE RECEIVED REQUEST");
    next();
  },
  requireUser,
  resumeRazorpayCheckout
);

module.exports = router;
