
const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    type: {
      type: String,
      enum: ["product", "category"],
      required: true,
    },

    target: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },

    maximumDiscount: {
      type: Number,
      required: true,
      min: 0,
    },

    startsAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Background image for the homepage announcement banner
    bannerImage: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

offerSchema.index({
  type: 1,
  target: 1,
  isActive: 1,
  startsAt: 1,
  expiresAt: 1,
});

module.exports = mongoose.model("Offer", offerSchema);
