const mongoose = require("mongoose");
const Review = require("../models/Review");
const Order = require("../models/Order");
const Product = require("../models/Product");
const validId = (id) => mongoose.isValidObjectId(id);

async function eligibleOrder(userId, productId) {
  // Only paid, delivered, non-returned line items qualify.
  const orders = await Order.find({ user: userId, paymentStatus: "Paid", "items.product": productId })
    .select("items paymentStatus").sort({ createdAt: -1 }).lean();
  return orders.find(order => order.items.some(item =>
    String(item.product) === String(productId) && item.status === "Delivered"
  ));
}

exports.getEligibility = async (req, res) => {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID" });
    const [order, review] = await Promise.all([
      eligibleOrder(req.user._id, req.params.productId),
      Review.findOne({ user: req.user._id, product: req.params.productId }).lean(),
    ]);
    return res.json({ eligible: Boolean(order), reviewed: Boolean(review), review });
  } catch (err) { console.error("Review eligibility error", err); return res.status(500).json({ message: "Could not check review eligibility" }); }
};

exports.createReview = async (req, res) => {
  try {
    const { productId, rating, title = "", comment } = req.body;
    if (!validId(productId)) return res.status(400).json({ message: "Invalid product ID" });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be an integer from 1 to 5" });
    if (typeof title !== "string" || title.length > 100 || typeof comment !== "string" || !comment.trim() || comment.length > 1000) return res.status(400).json({ message: "Invalid review text" });
    const product = await Product.exists({ _id: productId });
    if (!product) return res.status(404).json({ message: "Product not found" });
    const order = await eligibleOrder(req.user._id, productId);
    if (!order) return res.status(403).json({ message: "Only customers with a paid, delivered purchase can review this product" });
    const review = await Review.create({ user: req.user._id, product: productId, order: order._id, rating, title: title.trim(), comment: comment.trim() });
    return res.status(201).json({ message: "Review submitted", review });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "You have already reviewed this product. Edit your existing review instead." });
    console.error("Create review error", err); return res.status(500).json({ message: "Could not submit review" });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ message: "Invalid product ID" });
    const filter = { product: req.params.productId, status: "published" };
    const [reviews, stats] = await Promise.all([
      Review.find(filter).populate("user", "fullName").sort({ createdAt: -1 }).limit(100).lean(),
      Review.aggregate([{ $match: { product: new mongoose.Types.ObjectId(req.params.productId), status: "published" } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } }]),
    ]);
    return res.json({ reviews, count: stats[0]?.count || 0, averageRating: stats[0]?.average || 0 });
  } catch (err) { console.error("List reviews error", err); return res.status(500).json({ message: "Could not load reviews" }); }
};

exports.updateReview = async (req, res) => {
  try {
    if (!validId(req.params.reviewId)) return res.status(400).json({ message: "Invalid review ID" });
    const review = await Review.findOne({ _id: req.params.reviewId, user: req.user._id });
    if (!review) return res.status(404).json({ message: "Review not found" });
    const { rating, title, comment } = req.body;
    if (rating !== undefined) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1–5" });
      review.rating = rating;
    }
    if (title !== undefined) {
      if (typeof title !== "string" || title.length > 100) return res.status(400).json({ message: "Invalid title" });
      review.title = title.trim();
    }
    if (comment !== undefined) {
      if (typeof comment !== "string" || !comment.trim() || comment.length > 1000) return res.status(400).json({ message: "Invalid comment" });
      review.comment = comment.trim();
    }
    await review.save(); return res.json({ message: "Review updated", review });
  } catch (err) { console.error("Update review error", err); return res.status(500).json({ message: "Could not update review" }); }
};

exports.deleteReview = async (req, res) => {
  try {
    if (!validId(req.params.reviewId)) return res.status(400).json({ message: "Invalid review ID" });
    const result = await Review.findOneAndDelete({ _id: req.params.reviewId, user: req.user._id });
    if (!result) return res.status(404).json({ message: "Review not found" });
    return res.json({ message: "Review deleted" });
  } catch (err) { console.error("Delete review error", err); return res.status(500).json({ message: "Could not delete review" }); }
};

// Lightweight review statistics for product cards and details.
exports.getRatingSummaries = async (req, res) => {
  try {
    const ids = String(req.query.ids || "").split(",").filter(Boolean);
    if (!ids.length || ids.length > 100 || ids.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Provide 1 to 100 valid product IDs" });
    }
    const uniqueIds = [...new Set(ids)];
    const stats = await Review.aggregate([
      { $match: { product: { $in: uniqueIds.map(id => new mongoose.Types.ObjectId(id)) }, status: "published" } },
      { $group: { _id: "$product", count: { $sum: 1 }, averageRating: { $avg: "$rating" } } }
    ]);
    const ratings = Object.fromEntries(uniqueIds.map(id => [id, { count: 0, averageRating: 0 }]));
    stats.forEach(item => { ratings[String(item._id)] = { count: item.count, averageRating: item.averageRating }; });
    return res.json({ ratings });
  } catch (error) {
    console.error("Review rating summaries error", error);
    return res.status(500).json({ message: "Could not load product ratings" });
  }
};
