
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    discountType: {
      type: String,
      enum: ["percentage"],
      default: "percentage",
    },

    discountValue: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    minimumPurchase: {
      type: Number,
      required: true,
      default: 500,
      min: 0,
    },

    maximumDiscount: {
      type: Number,
      required: true,
      default: 100,
      min: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Coupon",
  couponSchema
);
