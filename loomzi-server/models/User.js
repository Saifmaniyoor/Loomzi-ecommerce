const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: function () { return !this.googleId; },
      unique: true,
      trim: true,
    },

    password: {
      type: String,
      required: function () { return !this.googleId; },
      minlength: 8,
      select: false,
    },

    googleId: { type: String, unique: true, sparse: true, default: undefined },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // OTP for email verification
    otp: {
      type: String,
      default: null,
    },

    // Time when OTP expires
    otpExpires: {
      type: Date,
      default: null,
    },

    otpResendAvailableAt: { type: Date, default: null },

    pendingEmail: { type: String, default: null },
    emailChangeOtpHash: { type: String, default: null, select: false },
    emailChangeOtpExpires: { type: Date, default: null },
    emailChangeResendAt: { type: Date, default: null },
    emailChangeAttempts: { type: Number, default: 0 },

    resetOtp: {
      type: String,
      default: null,
    },

    resetOtpExpires: {
      type: Date,
      default: null,
    },

    resetTokenHash: {
      type: String,
      default: null,
    },

    resetTokenExpires: {
      type: Date,
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

module.exports = User;
