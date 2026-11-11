
const express = require("express");

const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  getProfile,
  updateProfile,
  changePassword,
  requestEmailChange,
  verifyEmailChange,
} = require("../controllers/profileController");

// All profile routes require customer login
router.use(requireUser);

// GET /api/profile
router.get("/", getProfile);

// PATCH /api/profile
router.patch("/", updateProfile);
router.patch("/password", changePassword);
router.post("/email/request", requestEmailChange);
router.post("/email/verify", verifyEmailChange);

module.exports = router;
