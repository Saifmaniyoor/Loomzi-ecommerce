
const User = require("../models/User");

// Get profile by customer ID
const findProfileById = async (userId) => {
  return await User.findById(userId).select(
    "fullName email phone isVerified isBlocked"
  );
};

// Check if phone number is already used
const findUserByPhone = async (phone) => {
  return await User.findOne({ phone }).select("_id");
};

// Update customer profile
const updateProfileById = async (userId, updates) => {
  return await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    {
      new: true,
      runValidators: true,
    }
  ).select("fullName email phone");
};


// Fetch the user's password hash
const findUserWithPassword = async (userId) => {
  return await User.findById(userId).select("+password");
};

// Save the new hashed password
const updateUserPassword = async (userId, hashedPassword) => {
  return await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        password: hashedPassword,
      },
    },
    {
      runValidators: true,
    }
  );
};


module.exports = {
  findProfileById,
  findUserByPhone,
  updateProfileById,
  findUserWithPassword,
  updateUserPassword,
};
