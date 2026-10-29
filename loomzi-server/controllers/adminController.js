const { sendAdminWelcomeEmail } = require("../services/adminEmailService");

const bcrypt = require("bcrypt");
const crypto = require("node:crypto");
const adminServices = require("../services/adminServices");

const registerSuperAdmin = async (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword, setupSecret } =
      req.body || {};

    // Validate setup secret
    const expectedSecret = process.env.SUPER_ADMIN_SETUP_SECRET;

    if (!expectedSecret || typeof setupSecret !== "string") {
      return res.status(403).json({
        message: "Admin registration is not authorized",
      });
    }

    const provided = Buffer.from(setupSecret);
    const expected = Buffer.from(expectedSecret);

    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return res.status(403).json({
        message: "Admin registration is not authorized",
      });
    }

    // Validate required fields
    if (
      [fullName, email, phone, password, confirmPassword].some(
        (value) => typeof value !== "string" || !value.trim(),
      )
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Please enter a valid 10-digit phone number",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // Check existing Super Admin
    const existingSuperAdmin = await adminServices.findSuperAdmin();

    if (existingSuperAdmin) {
      return res.status(403).json({
        message: "Super Admin account already exists",
      });
    }

    // Check duplicate email and phone
    const existingEmail = await adminServices.findAdminByEmail(normalizedEmail);

    if (existingEmail) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    const existingPhone = await adminServices.findAdminByPhone(normalizedPhone);

    if (existingPhone) {
      return res.status(409).json({
        message: "Phone number already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // 1. Save Super Admin in MongoDB
    const admin = await adminServices.createSuperAdmin({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: normalizedPhone,
      password: hashedPassword,
    });

    // 2. Send welcome email
    try {
      await sendAdminWelcomeEmail(admin);
    } catch (emailError) {
      console.error("Welcome email failed:", emailError.message);
    }

    // 3. Send registration success response
    return res.status(201).json({
      message: "Super Admin registered successfully",
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Super Admin registration error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Admin account already exists",
      });
    }

    return res.status(500).json({
      message: "Server error",
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};

    // 1. Validate input
    if (
      typeof identifier !== "string" ||
      typeof password !== "string" ||
      !identifier.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email or phone and password are required",
      });
    }

    // 2. Find admin through service
    const admin = await adminServices.findAdminForLogin(identifier.trim());

    if (!admin) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // 3. Compare password
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    // 4. Check account status
    if (!admin.isActive) {
      return res.status(403).json({
        message: "Admin account is inactive",
      });
    }

    // 5. Create new session
    req.session.regenerate((error) => {
      if (error) {
        console.error("Admin session error:", error);

        return res.status(500).json({
          message: "Unable to create admin session",
        });
      }

      req.session.adminId = admin._id.toString();
      req.session.adminRole = admin.role;
      req.session.adminCredentialVersion = admin.credentialVersion ?? 0;

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Admin session save error:", saveError);

          return res.status(500).json({
            message: "Unable to save admin session",
          });
        }

        return res.status(200).json({
          message: "Admin login successful",
          admin: {
            id: admin._id,
            fullName: admin.fullName,
            email: admin.email,
            role: admin.role,
          },
        });
      });
    });
  } catch (error) {
    console.error("Admin login error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};


const logoutAdmin = (req, res) => {
  if (!req.session) {
    return res.status(200).json({
      message: "Admin logged out successfully",
    });
  }

  req.session.destroy((error) => {
    if (error) {
      console.error("Admin logout error:", error);

      return res.status(500).json({
        message: "Unable to logout",
      });
    }

    res.clearCookie("loomzi.sid", {
      path: "/",
    });

    return res.status(200).json({
      message: "Admin logged out successfully",
    });
  });
};


const getCustomers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination values",
      });
    }

    const result = await adminServices.getAllCustomers(
      search,
      page,
      limit
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
};

const mongoose = require("mongoose");

// Block or unblock customer
const changeCustomerBlockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const isBlocked = action === "block";

    const customer = await adminServices.updateCustomerBlockStatus(
      id,
      isBlocked
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: isBlocked
        ? "Customer blocked successfully"
        : "Customer unblocked successfully",
      customer,
    });
  } catch (error) {
    console.error("Change customer status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer status",
    });
  }
};

module.exports.getCustomers = getCustomers;


module.exports = {
  registerSuperAdmin,
  loginAdmin,
  logoutAdmin,
  getCustomers,
  changeCustomerBlockStatus,
};
