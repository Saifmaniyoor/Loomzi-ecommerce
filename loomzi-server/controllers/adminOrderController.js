const mongoose = require("mongoose");
const Order = require("../models/Order");
const { releaseStock } = require("../services/inventoryServices");
const razorpay = require("../config/razorpay");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
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

const ADMIN_CANCELABLE_STATUSES = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery"];

const getCancellationPayment = (order) => {
  const totalPaise = Math.round(order.totalAmount * 100);
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) return null;
  if (order.paymentMethod === "COD" && order.paymentStatus === "Pending") {
    return { walletPaise: 0, razorpayPaise: 0, totalPaise, cod: true };
  }
  if (order.paymentStatus !== "Paid") return null;
  if (order.paymentMethod === "Wallet") {
    const b = order.paymentBreakdown;
    if (!b || b.totalPaise !== totalPaise || b.walletPaise !== totalPaise || b.razorpayPaise !== 0 || b.walletStatus !== "Settled") return null;
    return { walletPaise: totalPaise, razorpayPaise: 0, totalPaise, cod: false };
  }
  if (order.paymentMethod === "Razorpay") {
    if (!order.razorpayPaymentId) return null;
    const b = order.paymentBreakdown;
    if (b && (b.totalPaise !== totalPaise || b.walletPaise !== 0 || b.razorpayPaise !== totalPaise)) return null;
    return { walletPaise: 0, razorpayPaise: totalPaise, totalPaise, cod: false };
  }
  if (order.paymentMethod === "Wallet+Razorpay") {
    const b = order.paymentBreakdown;
    if (!order.razorpayPaymentId || !b || b.walletStatus !== "Settled" || b.totalPaise !== totalPaise || !Number.isSafeInteger(b.walletPaise) || !Number.isSafeInteger(b.razorpayPaise) || b.walletPaise <= 0 || b.razorpayPaise < 100 || b.walletPaise + b.razorpayPaise !== totalPaise) return null;
    return { walletPaise: b.walletPaise, razorpayPaise: b.razorpayPaise, totalPaise, cod: false };
  }
  return null;
};

// Admin cancellation is a separate, audited operation. For shipped parcels,
// the admin must confirm that the courier has intercepted/returned the parcel
// before stock is restored and a refund is initiated.
const cancelOrder = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid order ID" });
  const reason = String(req.body?.reason || "").trim();
  const refundMethod = req.body?.refundMethod || "original";
  if (!reason || reason.length > 450) return res.status(400).json({ message: "Enter a cancellation reason (maximum 450 characters)" });
  if (!["original", "wallet"].includes(refundMethod)) return res.status(400).json({ message: "Invalid refund destination" });

  const session = await mongoose.startSession();
  let cancelledOrder;
  let gatewayAmountPaise = 0;
  let walletCreditPaise = 0;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(id).session(session);
      if (!order) { const e = new Error("Order not found"); e.statusCode = 404; throw e; }
      if (!ADMIN_CANCELABLE_STATUSES.includes(order.orderStatus)) {
        const e = new Error("Only Pending, Confirmed, Processing, Shipped or Out for Delivery orders can be cancelled. Delivered orders must use the returns process."); e.statusCode = 409; throw e;
      }
      const shipped = ["Shipped", "Out for Delivery"].includes(order.orderStatus);
      if (shipped && req.body?.shipmentRecovered !== true) {
        const e = new Error("Confirm that the courier has intercepted/returned the parcel before cancelling this shipped order."); e.statusCode = 400; throw e;
      }
      if (order.refund?.status && order.refund.status !== "Not Required") {
        const e = new Error("A refund is already in progress or requires review"); e.statusCode = 409; throw e;
      }
      const allocation = getCancellationPayment(order);
      if (!allocation) { const e = new Error("Payment is not eligible for automatic cancellation/refund. Review the payment manually."); e.statusCode = 409; throw e; }

      gatewayAmountPaise = refundMethod === "wallet" ? 0 : allocation.razorpayPaise;
      walletCreditPaise = allocation.walletPaise + (refundMethod === "wallet" ? allocation.razorpayPaise : 0);

      order.orderStatus = "Cancelled";
      order.statusHistory.push({ status: "Cancelled", note: `Cancelled by admin: ${reason}`, updatedBy: "admin" });
      order.items.forEach((item) => { item.status = "Cancelled"; });
      order.refund = allocation.cod ? { status: "Not Required", destination: "Razorpay", amount: 0, note: reason } : {
        status: gatewayAmountPaise > 0 ? "Initiating" : "Processed",
        destination: gatewayAmountPaise > 0 ? "Razorpay" : "Wallet",
        amount: order.totalAmount,
        requestedAt: new Date(),
        note: gatewayAmountPaise > 0 ? `Admin cancellation: ${reason}. Wallet credit ${walletCreditPaise} paise; Razorpay refund ${gatewayAmountPaise} paise.` : `Admin cancellation: ${reason}. Refund credited to wallet.`,
      };
      if (!allocation.cod && gatewayAmountPaise === 0) order.paymentStatus = "Refunded";
      await order.save({ session });

      // Stock is returned only after the admin confirms shipment recovery for shipped orders.
      for (const item of order.items) {
        const product = await releaseStock({ productId: item.product, variantId: item.variantId || null, quantity: item.quantity, session });
        if (!product) throw new Error(`Unable to restore stock for ${item.name}`);
      }
      if (walletCreditPaise > 0) {
        await WalletTransaction.create([{
          user: order.user, order: order._id, kind: "cancellation_credit",
          amountPaise: walletCreditPaise, reference: `admin-cancel:${order._id}`,
          description: "Admin cancellation refund credited to Loomzi wallet",
        }], { session });
        await Wallet.updateOne({ user: order.user }, { $inc: { balancePaise: walletCreditPaise } }, { upsert: true, session });
      }
      cancelledOrder = order.toObject();
    });
  } catch (error) {
    console.error("Admin cancel order:", error);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Unable to cancel order safely" });
  } finally {
    await session.endSession();
  }

  if (gatewayAmountPaise > 0) {
    try {
      const refund = await razorpay.payments.refund(cancelledOrder.razorpayPaymentId, {
        amount: gatewayAmountPaise,
        speed: "normal",
        notes: { orderId: String(cancelledOrder._id), reason: `Admin cancellation: ${reason}` },
      });
      const processed = refund.status === "processed";
      await Order.updateOne({ _id: id, "refund.status": "Initiating" }, { $set: {
        "refund.status": processed ? "Processed" : "Pending",
        "refund.razorpayRefundId": refund.id,
        ...(processed ? { paymentStatus: "Refunded" } : {}),
      }});
    } catch (error) {
      console.error("Admin refund outcome uncertain; verify with Razorpay before retrying:", error);
      await Order.updateOne({ _id: id, "refund.status": "Initiating" }, { $set: {
        "refund.status": "Needs Review",
        "refund.note": "Admin cancellation recorded. Razorpay refund outcome uncertain; verify with gateway before retrying.",
      }});
    }
  }
  const updated = await Order.findById(id).populate("user", "fullName email phone").lean();
  return res.json({
    message: gatewayAmountPaise > 0 ? "Order cancelled. Razorpay refund has been requested; check refund status." : walletCreditPaise > 0 ? "Order cancelled and refund credited to Loomzi wallet." : "Order cancelled successfully.",
    order: updated,
  });
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
module.exports = { listOrders, getOrder, updateDelivery, cancelOrder };
