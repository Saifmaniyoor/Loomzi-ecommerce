const mongoose = require("mongoose");
const { createPaymentOrder } = require("../services/paymentOrchestrationServices");
const CheckoutAttempt = require("../models/CheckoutAttempt");
const Order = require("../models/Order");

const createCheckoutRazorpayOrder = async (req, res) => {
  const userId = req.user?._id;
  const { attemptId, orderId } = req.body || {};
  if (!userId || !mongoose.isValidObjectId(attemptId) || !mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Valid attemptId and orderId required" });
  }
  try {
    const attempt = await CheckoutAttempt.findOne({ _id: attemptId, user: userId, order: orderId, paymentMethod: "Razorpay" });
    const order = await Order.findOne({ _id: orderId, user: userId, paymentMethod: "Razorpay" });
    if (!attempt || !order) return res.status(404).json({ message: "Checkout not found" });
    // A Ready attempt must be reconciled rather than creating a second Razorpay order.
    if (attempt.status !== "Processing") {
      return res.status(409).json({ message: "Payment attempt already exists or needs reconciliation. Check your order status; do not retry payment creation." });
    }
    const payment = await createPaymentOrder({ attemptId, userId, orderId });
    if (!payment || !/^order_[a-zA-Z0-9]+$/.test(payment.razorpayOrderId || "")) {
      throw new Error("Razorpay order response invalid");
    }
    return res.status(201).json({
      orderId: String(orderId),
      razorpayOrderId: payment.razorpayOrderId,
      amountInPaise: payment.amountInPaise,
      currency: payment.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      reservationExpiresAt: payment.reservationExpiresAt,
    });
  } catch (error) {
    console.error("Create Razorpay checkout order:", error);
    return res.status(409).json({ message: "Payment creation could not be confirmed. Check order status before trying again." });
  }
};

const getRazorpayCheckoutStatus = async (req, res) => {
  const userId = req.user?._id;
  const { orderId } = req.params;
  if (!userId || !mongoose.isValidObjectId(orderId)) return res.status(400).json({ message: "Invalid order ID" });
  const order = await Order.findOne({ _id: orderId, user: userId, paymentMethod: "Razorpay" }).select("paymentStatus orderStatus razorpayOrderId").lean();
  if (!order) return res.status(404).json({ message: "Order not found" });
  return res.json({ orderId, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus, hasRazorpayOrder: Boolean(order.razorpayOrderId) });
};
module.exports = { createCheckoutRazorpayOrder, getRazorpayCheckoutStatus };
