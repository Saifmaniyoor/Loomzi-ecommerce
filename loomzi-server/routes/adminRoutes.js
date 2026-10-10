
const express = require("express");
const router = express.Router();

const {
  loginAdmin,
  logoutAdmin,
  getCustomers,
  changeCustomerBlockStatus,
} = require("../controllers/adminController");

const requireAdmin = require("../middleware/requireAdmin");

// Public admin login
router.post("/login", loginAdmin);

// Protected dashboard
router.get("/dashboard", requireAdmin, (req, res) => {
  return res.status(200).json({
    message: "Welcome to Loomzi Admin Dashboard",
    adminId: req.admin._id,
    fullName: req.admin.fullName,
    email: req.admin.email,
    role: req.admin.role,
  });
});

router.patch(
  "/customers/:id/:action",
  requireAdmin,
  (req, res, next) => {
    if (!["block", "unblock"].includes(req.params.action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer action",
      });
    }

    next();
  },
  changeCustomerBlockStatus
);

// Protected Customer Management
router.get("/customers", requireAdmin, getCustomers);

// Protected logout
router.post("/logout", requireAdmin, logoutAdmin);

module.exports = router;
