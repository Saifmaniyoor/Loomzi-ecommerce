const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema(
  {
    color: {
      type: String,
      required: true,
      trim: true,
    },

    size: {
      type: String,
      trim: true,
      default: "",
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    price: {
      type: Number,
      min: 0,
    },

    offerPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    sku: {
      type: String,
      trim: true,
    },
  },
  { _id: true },
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    offerPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    images: {
      type: [String],
      default: [],
    },

    sizeType: {
      type: String,
      enum: ["age", "standard", "none"],
      required: true,
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    stock: {
      type: Number,
      min: 0,
      default: 0,
    },

    isListed: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
