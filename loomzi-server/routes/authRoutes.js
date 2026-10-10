
const express = require("express");
const router = express.Router();

// Import controllers
const {
  registerUser,
  verifyOtp,
  loginUser,
  getCurrentUser,
  logoutUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
} = require("../controllers/authController");

// Register user
router.post("/register", registerUser);

// Verify OTP
router.post("/verify-otp", verifyOtp);

// Login user
router.post("/login", loginUser);

// Get logged-in user
router.get("/me", getCurrentUser);

// Logout user
router.post("/logout", logoutUser);

router.post("/forgot-password", forgotPassword);

router.post("/verify-reset-otp", verifyResetOtp);

router.post("/reset-password", resetPassword);

module.exports = router;
