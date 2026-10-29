
const mongoose = require("mongoose");
const adminServices = require("../services/adminServices");

const requireAdmin = async (req, res, next) => {
  try {
    const adminId = req.session?.adminId;

    if (!adminId || !mongoose.isValidObjectId(adminId)) {
      return res.status(401).json({
        message: "Admin login required",
      });
    }

    const admin = await adminServices.findAdminById(adminId);

    if (!admin) {
      return res.status(401).json({
        message: "Admin account not found",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        message: "Admin account is inactive",
      });
    }

    if (admin.role !== "super_admin") {
      return res.status(403).json({
        message: "Super Admin access required",
      });
    }

    if (req.session.adminCredentialVersion !== (admin.credentialVersion ?? 0)) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.admin = admin;

    next();
  } catch (error) {
    console.error("Admin authentication error:", error);

    return res.status(500).json({
      message: "Authentication failed",
    });
  }
};

module.exports = requireAdmin;
