
const express = require("express");
const router = express.Router();

const {
  loginAdmin,
  logoutAdmin,
  getCustomers,
  changeCustomerBlockStatus,
} = require("../controllers/adminController");

const requireAdmin = require("../middleware/requireAdmin");
const security = require("../controllers/adminSecurityController");
const { getDashboardStats, exportCsv, exportPdf } = require("../controllers/adminDashboardController");

// Public password recovery
router.post("/forgot-password", security.requestReset);
router.post("/verify-reset-otp", security.verifyResetOtp);
router.post("/reset-password", security.resetPassword);

router.get("/settings/account", requireAdmin, security.getAccount);
router.patch("/settings/account", requireAdmin, security.changeCredentials);
router.post("/settings/email/send-otp", requireAdmin, security.sendEmailOtp);
router.post("/settings/email/verify-otp", requireAdmin, security.verifyEmailOtp);

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

router.get("/dashboard/stats", requireAdmin, getDashboardStats);
router.get("/dashboard/export/csv", requireAdmin, exportCsv);
router.get("/dashboard/export/pdf", requireAdmin, exportPdf);

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
