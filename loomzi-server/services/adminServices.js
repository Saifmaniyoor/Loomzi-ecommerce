const Admin = require("../models/Admin");

// Check existing email
const findAdminByEmail = async (email) => {
  return await Admin.findOne({ email });
};

// Check existing phone
const findAdminByPhone = async (phone) => {
  return await Admin.findOne({ phone });
};

// Check whether Super Admin already exists
const findSuperAdmin = async () => {
  return await Admin.findOne({ role: "super_admin" });
};

// Create Super Admin
const createSuperAdmin = async (adminData) => {
  return await Admin.create({
    ...adminData,
    role: "super_admin",
  });
};

// Find admin by email or phone, including password
const findAdminForLogin = async (identifier) => {
  return await Admin.findOne({
    $or: [{ email: identifier.toLowerCase() }, { phone: identifier }],
  }).select("+password");
};

const findAdminById = async (id) => {
  return await Admin.findById(id).select("fullName email phone role isActive credentialVersion");
};

const User = require("../models/User");

// Get all customer
const getAllCustomers = async (search = "", page = 1, limit = 10) => {
  const query = {};

  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    query.$or = [
      { fullName: { $regex: safeSearch, $options: "i" } },
      { email: { $regex: safeSearch, $options: "i" } },
      { phone: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [customers, totalCustomers] = await Promise.all([
    User.find(query)
      .select("fullName email phone createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    User.countDocuments(query),
  ]);

  return {
    customers,
    totalCustomers,
    currentPage: page,
    totalPages: Math.ceil(totalCustomers / limit),
  };
};

// Find customer
const findCustomerById = async (id) => {
  return await User.findById(id)
    .select("fullName email phone isBlocked createdAt")
    .lean();
};

const updateCustomerBlockStatus = async (id, isBlocked) => {
  return await User.findByIdAndUpdate(
    id,
    { $set: { isBlocked } },
    { new: true, runValidators: true },
  )
    .select("fullName email phone isBlocked createdAt")
    .lean();
};

module.exports = {
  findAdminByEmail,
  findAdminByPhone,
  findSuperAdmin,
  createSuperAdmin,
  findAdminForLogin,
  findAdminById,
  getAllCustomers,
  findCustomerById,
  updateCustomerBlockStatus,
};
