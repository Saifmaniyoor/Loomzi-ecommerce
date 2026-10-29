const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["super_admin", "vendor_admin"],
      default: "vendor_admin",
    },
    credentialVersion: { type: Number, default: 0 },
    resetOtpHash: { type: String, select: false, default: null },
    resetOtpExpiresAt: { type: Date, select: false, default: null },
    resetOtpAttempts: { type: Number, select: false, default: 0 },
    pendingEmail: { type: String, select: false, default: null },
    pendingEmailOtpHash: { type: String, select: false, default: null },
    pendingEmailOtpExpiresAt: { type: Date, select: false, default: null },
    pendingEmailOtpAttempts: { type: Number, select: false, default: 0 },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);