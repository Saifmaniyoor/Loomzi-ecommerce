
const User = require("../models/User");

// =====================================
// FIND USER BY EMAIL
// =====================================
const findUserByEmail = (email) =>
  User.findOne({ email });

// =====================================
// FIND USER BY PHONE
// =====================================
const findUserByPhone = (phone) =>
  User.findOne({ phone });

// =====================================
// CREATE USER
// =====================================
const createUser = (data) =>
  User.create(data);

// =====================================
// FIND USER FOR LOGIN
// =====================================
const findUserForLogin = (email) =>
  User.findOne({ email }).select("+password");

// =====================================
// FIND USER BY ID
// Updated for customer authentication
// =====================================
const findUserById = (id) =>
  User.findById(id).select(
    "fullName email isVerified isBlocked"
  );

// =====================================
// MARK EMAIL AS VERIFIED
// =====================================
const markEmailVerified = (userId) =>
  User.findByIdAndUpdate(userId, {
    $set: {
      isVerified: true,
    },
    $unset: {
      otp: "",
      otpExpires: "",
      otpResendAvailableAt: "",
    },
  });

// =====================================
// SAVE PASSWORD RESET OTP
// =====================================
const savePasswordResetOtp = (
  userId,
  resetOtp,
  resetOtpExpires
) =>
  User.findByIdAndUpdate(userId, {
    $set: {
      resetOtp,
      resetOtpExpires,
    },
  });

// =====================================
// SAVE PASSWORD RESET TOKEN
// =====================================
const savePasswordResetToken = (
  userId,
  resetTokenHash,
  resetTokenExpires
) =>
  User.findByIdAndUpdate(userId, {
    $set: {
      resetTokenHash,
      resetTokenExpires,
    },
    $unset: {
      resetOtp: "",
      resetOtpExpires: "",
    },
  });

// =====================================
// FIND USER BY VALID RESET TOKEN
// =====================================
const findUserByValidResetToken = (
  email,
  tokenHash
) =>
  User.findOne({
    email,
    resetTokenHash: tokenHash,
    resetTokenExpires: {
      $gt: new Date(),
    },
  }).select("+password");

// =====================================
// UPDATE PASSWORD WITH VALID TOKEN
// =====================================
const updatePasswordWithValidToken = (
  userId,
  tokenHash,
  hashedPassword
) =>
  User.findOneAndUpdate(
    {
      _id: userId,
      resetTokenHash: tokenHash,
      resetTokenExpires: {
        $gt: new Date(),
      },
    },
    {
      $set: {
        password: hashedPassword,
      },
      $unset: {
        resetOtp: "",
        resetOtpExpires: "",
        resetTokenHash: "",
        resetTokenExpires: "",
      },
    },
    {
      new: true,
    }
  );

// =====================================
// EXPORT SERVICES
// =====================================
module.exports = {
  findUserByEmail,
  findUserByPhone,
  createUser,
  findUserForLogin,
  findUserById,
  markEmailVerified,
  savePasswordResetOtp,
  savePasswordResetToken,
  findUserByValidResetToken,
  updatePasswordWithValidToken,
};
