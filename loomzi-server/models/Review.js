const mongoose = require("mongoose");
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 100, default: "" },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ["published", "hidden"], default: "published" },
}, { timestamps: true });
reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model("Review", reviewSchema);
