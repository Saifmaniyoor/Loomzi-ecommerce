const User = require("../models/User");

const findUserByEmail = (email) => User.findOne({ email });
const findUserByPhone = (phone) => User.findOne({ phone });
const createUser = (data) => User.create(data);
const findUserForLogin = (email) => User.findOne({ email }).select("+password");
const findUserById = (id) => User.findById(id).select("fullName email");

const markEmailVerified = (userId) => User.findByIdAndUpdate(userId, {
  $set: { isVerified: true },
  $unset: { otp: "", otpExpires: "" },
});

const savePasswordResetOtp = (userId, resetOtp, resetOtpExpires) =>
  User.findByIdAndUpdate(userId, { $set: { resetOtp, resetOtpExpires } });

const savePasswordResetToken = (userId, resetTokenHash, resetTokenExpires) =>
  User.findByIdAndUpdate(userId, {
    $set: { resetTokenHash, resetTokenExpires },
    $unset: { resetOtp: "", resetOtpExpires: "" },
  });

const findUserByValidResetToken = (email, tokenHash) =>
  User.findOne({
    email,
    resetTokenHash: tokenHash,
    resetTokenExpires: { $gt: new Date() },
  }).select("+password");

const updatePasswordWithValidToken = (userId, tokenHash, hashedPassword) =>
  User.findOneAndUpdate(
    {
      _id: userId,
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    },
    {
      $set: { password: hashedPassword },
      $unset: {
        resetOtp: "",
        resetOtpExpires: "",
        resetTokenHash: "",
        resetTokenExpires: "",
      },
    },
    { new: true }
  );

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
