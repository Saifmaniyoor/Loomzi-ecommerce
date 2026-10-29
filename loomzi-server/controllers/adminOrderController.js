const mongoose = require("mongoose");
const Order = require("../models/Order");
const STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
const fail = (res, e) => { console.error("Admin orders:", e); return res.status(500).json({ message: "Order request failed" }); };
const listOrders = async (req, res) => {
  try {
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    const status = String(req.query.status || "");
    const filter = STATUSES.includes(status) ? { orderStatus: status } : {};
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 20).limit(20)
        .populate("user", "fullName email phone").lean(),
      Order.countDocuments(filter),
    ]);
    return res.json({ orders, total, page, pages: Math.ceil(total / 20) });
  } catch (e) { return fail(res, e); }
};
const getOrder = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid order ID" });
    const order = await Order.findById(req.params.id).populate("user", "fullName email phone").lean();
    return order ? res.json({ order }) : res.status(404).json({ message: "Order not found" });
  } catch (e) { return fail(res, e); }
};
const updateDelivery = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid order ID" });
    const { status, note, courier, trackingNumber, trackingUrl, estimatedDelivery } = req.body || {};
    if (!STATUSES.includes(status) || status === "Cancelled") return res.status(400).json({ message: "Select a valid delivery status. Cancellation requires a separate stock/refund process." });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (["Cancelled", "Delivered"].includes(order.orderStatus) && status !== order.orderStatus) return res.status(409).json({ message: "Completed or cancelled orders cannot be reopened here" });
    if (order.paymentStatus === "Failed" || (order.paymentMethod === "Razorpay" && order.paymentStatus !== "Paid")) return res.status(409).json({ message: "Payment is not confirmed" });
    const oldIndex = STATUSES.indexOf(order.orderStatus);
    const newIndex = STATUSES.indexOf(status);
    if (newIndex < oldIndex) return res.status(409).json({ message: "Cannot move delivery status backwards" });
    if (typeof note === "string" && note.length > 500) return res.status(400).json({ message: "Note too long" });
    for (const [key, value, max] of [["courier", courier, 100], ["trackingNumber", trackingNumber, 120], ["trackingUrl", trackingUrl, 1000]]) {
      if (value !== undefined && (typeof value !== "string" || value.length > max)) return res.status(400).json({ message: `Invalid ${key}` });
    }
    if (trackingUrl && !/^https:\/\//i.test(trackingUrl)) return res.status(400).json({ message: "Tracking URL must use HTTPS" });
    if (estimatedDelivery !== undefined && estimatedDelivery !== "" && !Number.isFinite(Date.parse(estimatedDelivery))) return res.status(400).json({ message: "Invalid estimated delivery date" });
    order.tracking ||= {};
    if (courier !== undefined) order.tracking.courier = courier.trim();
    if (trackingNumber !== undefined) order.tracking.trackingNumber = trackingNumber.trim();
    if (trackingUrl !== undefined) order.tracking.trackingUrl = trackingUrl.trim();
    if (estimatedDelivery !== undefined) order.tracking.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null;
    if (status !== order.orderStatus) {
      order.orderStatus = status;
      order.statusHistory.push({ status, note: String(note || "").trim(), updatedBy: "admin" });
      for (const item of order.items) {
        if (status === "Processing" || status === "Out for Delivery") continue;
        if (status === "Confirmed" || status === "Shipped" || status === "Delivered") item.status = status;
      }
    } else if (String(note || "").trim()) {
      order.statusHistory.push({ status, note: String(note).trim(), updatedBy: "admin" });
    }
    await order.save();
    return res.json({ message: "Delivery updated", order });
  } catch (e) { return fail(res, e); }
};
module.exports = { listOrders, getOrder, updateDelivery };
