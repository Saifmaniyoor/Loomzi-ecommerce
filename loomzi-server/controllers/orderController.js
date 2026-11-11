
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { releaseStock } = require("../services/inventoryServices");
const razorpay = require("../config/razorpay");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");

// ======================================
// Get All Orders of Logged-in Customer
// ======================================
const getMyOrders = async (req, res) => {
  try {
    // Customer ID from requireUser middleware
    const userId = req.user._id;

    // Find only this customer's orders
    // Newest orders first
    const orders = await Order.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .select(
        "items totalAmount paymentMethod paymentStatus orderStatus tracking refund createdAt"
      )
      .lean();

    // Format response for frontend
    const formattedOrders = orders.map((order) => ({
      id: order._id,
      items: order.items,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      tracking: order.tracking,
      refund: order.refund,
      createdAt: order.createdAt,
      canCancel: canCancelOrder(order),
    }));

    return res.status(200).json({
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("Get my orders error:", error);

    return res.status(500).json({
      message: "Failed to fetch orders",
    });
  }
};

// ======================================
// Get Single Order Details
// ======================================
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Validate the MongoDB order ID
    if (!mongoose.isObjectIdOrHexString(orderId)) {
      return res.status(400).json({
        message: "Invalid order ID",
      });
    }

    // req.user is provided by requireUser middleware
    const userId = req.user._id;

    // Find only an order belonging to this customer
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    }).lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Reconcile a known Razorpay refund on customer detail requests.
    // Never create a second refund from a status check.
    if (order.refund?.razorpayRefundId && ["Pending", "Initiating"].includes(order.refund.status)) {
      try {
        const gatewayRefund = await razorpay.refunds.fetch(order.refund.razorpayRefundId);
        if (gatewayRefund.status === "processed") {
          await Order.updateOne({ _id: order._id, "refund.razorpayRefundId": gatewayRefund.id },
            { $set: { "refund.status": "Processed", paymentStatus: "Refunded" } });
          order.refund.status = "Processed";
          order.paymentStatus = "Refunded";
        } else if (gatewayRefund.status === "failed") {
          await Order.updateOne({ _id: order._id, "refund.razorpayRefundId": gatewayRefund.id },
            { $set: { "refund.status": "Needs Review", "refund.note": "Razorpay reports refund failed; manual review required" } });
          order.refund.status = "Needs Review";
        }
      } catch (err) { console.error("Refund status check failed:", err); }
    }

    return res.status(200).json({
      order: {
        id: order._id,
        items: order.items,
        shippingAddress: order.shippingAddress,
        subtotal: order.subtotal,
        coupon: order.coupon,
        shippingCharge: order.shippingCharge,
        tax: order.tax,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        canCancel: canCancelOrder(order),
        tracking: order.tracking,
        refund: order.refund,
        statusHistory: order.statusHistory || [],
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error("Get order details error:", error);

    return res.status(500).json({
      message: "Failed to fetch order details",
    });
  }
};


// Cancellation is committed exactly once before calling Razorpay.
// A gateway timeout is NOT retried automatically: the refund may already exist.
const CANCELABLE_STATUSES = ["Pending", "Confirmed", "Processing"];

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

const canCancelOrder = (order) =>
  CANCELABLE_STATUSES.includes(order.orderStatus) &&
  (!order.refund?.status || order.refund.status === "Not Required") &&
  Boolean(getCancellationPayment(order));

// This operation is idempotent at the order and wallet-ledger level.
// Gateway failures are left for manual reconciliation, never blindly retried.
const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.isObjectIdOrHexString(orderId)) {
    return res.status(400).json({ message: "Invalid order ID" });
  }
  const refundMethod = req.body?.refundMethod || "original";
  if (!["wallet", "original"].includes(refundMethod)) {
    return res.status(400).json({ message: "Invalid refund method" });
  }

  const session = await mongoose.startSession();
  let cancelledOrder;
  let gatewayAmountPaise = 0;
  let walletCreditPaise = 0;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, user: req.user._id }).session(session);
      if (!order) { const e = new Error("Order not found"); e.statusCode = 404; throw e; }
      if (!canCancelOrder(order)) { const e = new Error("Order is not eligible for cancellation"); e.statusCode = 409; throw e; }
      const allocation = getCancellationPayment(order);
      gatewayAmountPaise = refundMethod === "wallet" ? 0 : allocation.razorpayPaise;
      walletCreditPaise = allocation.walletPaise + (refundMethod === "wallet" ? allocation.razorpayPaise : 0);

      // Claim the order first; a concurrent cancellation must not restore stock twice.
      order.orderStatus = "Cancelled";
      order.statusHistory.push({ status: "Cancelled", note: "Cancelled by customer", updatedBy: "customer" });
      order.items.forEach(item => { item.status = "Cancelled"; });
      order.refund = allocation.cod ? { status: "Not Required", destination: "Razorpay", amount: 0 } : {
        status: gatewayAmountPaise > 0 ? "Initiating" : "Processed",
        destination: gatewayAmountPaise > 0 ? "Razorpay" : "Wallet",
        amount: order.totalAmount,
        requestedAt: new Date(),
        note: gatewayAmountPaise > 0
          ? `Wallet credited ${walletCreditPaise} paise; Razorpay refund pending ${gatewayAmountPaise} paise`
          : "Refund credited to wallet",
      };
      if (!allocation.cod && gatewayAmountPaise === 0) order.paymentStatus = "Refunded";
      await order.save({ session });

      for (const item of order.items) {
        const product = await releaseStock({ productId: item.product, variantId: item.variantId || null, quantity: item.quantity, session });
        if (!product) throw new Error(`Unable to restore stock for ${item.name}`);
      }
      if (walletCreditPaise > 0) {
        await WalletTransaction.create([{
          user: order.user, order: order._id, kind: "cancellation_credit",
          amountPaise: walletCreditPaise, reference: `cancel:${order._id}`,
          description: "Customer cancellation wallet refund",
        }], { session });
        await Wallet.updateOne({ user: order.user }, { $inc: { balancePaise: walletCreditPaise } }, { upsert: true, session });
      }
      cancelledOrder = order.toObject();
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : "Unable to cancel order safely" });
  } finally {
    await session.endSession();
  }

  if (gatewayAmountPaise > 0) {
    try {
      const refund = await razorpay.payments.refund(cancelledOrder.razorpayPaymentId, {
        amount: gatewayAmountPaise, speed: "normal",
        notes: { orderId: String(cancelledOrder._id), reason: "Customer cancellation" },
      });
      const processed = refund.status === "processed";
      await Order.updateOne({ _id: orderId, "refund.status": "Initiating" }, { $set: {
        "refund.status": processed ? "Processed" : "Pending",
        "refund.razorpayRefundId": refund.id,
        ...(processed ? { paymentStatus: "Refunded" } : {}),
      }});
    } catch (error) {
      console.error("Refund outcome uncertain; verify with Razorpay before retrying:", error);
      await Order.updateOne({ _id: orderId, "refund.status": "Initiating" }, { $set: {
        "refund.status": "Needs Review", "refund.note": "Razorpay refund outcome uncertain. Check gateway before retrying.",
      }});
    }
  }
  const updated = await Order.findById(orderId).select("orderStatus paymentStatus refund").lean();
  return res.json({
    message: gatewayAmountPaise > 0
      ? "Order cancelled. Razorpay refund is being processed; check refund status."
      : walletCreditPaise > 0 ? "Order cancelled. Refund credited to Loomzi wallet." : "Order cancelled successfully.",
    order: { id: orderId, ...updated },
  });
};


// Download a sales invoice only for the authenticated customer's paid, active order.
const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!mongoose.isObjectIdOrHexString(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }
    const order = await Order.findOne({ _id: orderId, user: req.user._id }).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    const invoiceEligibleStatuses = ["Shipped", "Out for Delivery", "Delivered"];
    if (order.paymentStatus !== "Paid" ||
        !invoiceEligibleStatuses.includes(order.orderStatus) ||
        (order.items || []).some(item => ["Cancelled", "Returned", "Return Requested"].includes(item.status))) {
      return res.status(409).json({ message: "Invoice unavailable for this order status" });
    }

    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const money = value => `Rs. ${Number(value || 0).toFixed(2)}`;
    const safe = value => String(value ?? "").replace(/[\r\n]+/g, " ");
    const address = order.shippingAddress || {};
    const date = new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const number = String(order._id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Loomzi-Invoice-${number}.pdf"`);
    doc.on("error", err => { console.error("Invoice PDF error:", err); res.destroy(err); });
    doc.pipe(res);

    doc.fontSize(23).font("Helvetica-Bold").text("LOOMZI");
    doc.moveDown(0.3).fontSize(16).text("Sales Invoice");
    doc.moveDown(0.6).font("Helvetica").fontSize(10);
    doc.text(`Order reference: ${number}`);
    doc.text(`Order date: ${date}`);
    doc.text(`Payment: ${safe(order.paymentMethod)} (Paid)`);
    doc.moveDown(0.7).font("Helvetica-Bold").text("Bill to / Ship to");
    doc.font("Helvetica");
    [address.fullName, address.addressLine1, address.addressLine2, address.landmark,
      [address.city, address.state, address.pincode].filter(Boolean).join(", "),
      address.phone ? `Phone: ${address.phone}` : ""]
      .filter(Boolean).forEach(line => doc.text(safe(line)));
    doc.moveDown(1);

    const col = { item: 48, qty: 340, unit: 390, total: 490 };
    const header = () => {
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Product", col.item, doc.y, { width: 270 });
      const y = doc.y - 12;
      doc.text("Qty", col.qty, y, { width: 40, align: "right" });
      doc.text("Unit", col.unit, y, { width: 85, align: "right" });
      doc.text("Amount", col.total, y, { width: 72, align: "right" });
      doc.moveDown(0.7).moveTo(48, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.4).font("Helvetica");
    };
    header();
    for (const item of order.items || []) {
      if (doc.y > 690) { doc.addPage(); header(); }
      const y = doc.y;
      const variant = [item.color, item.size].filter(Boolean).join(" / ");
      const name = safe(item.name) + (variant ? ` (${safe(variant)})` : "");
      doc.text(name, col.item, y, { width: 270 });
      const endY = doc.y;
      doc.text(String(item.quantity), col.qty, y, { width: 40, align: "right" });
      doc.text(money(item.price), col.unit, y, { width: 85, align: "right" });
      doc.text(money(item.lineTotal), col.total, y, { width: 72, align: "right" });
      doc.y = Math.max(endY, y + 17) + 8;
    }
    if (doc.y > 635) doc.addPage();
    doc.moveDown(0.7);
    const totalRow = (label, amount, bold = false) => {
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(label, 320, y, { width: 150 });
      doc.text(money(amount), 472, y, { width: 90, align: "right" });
      doc.y = y + 22;
    };
    totalRow("Subtotal", order.subtotal);
    if (order.coupon?.discountAmount > 0) totalRow(`Coupon (${safe(order.coupon.code || "")})`, -order.coupon.discountAmount);
    totalRow("Shipping", order.shippingCharge);
    // No GST is charged or represented for this non-GST-registered seller.
    totalRow("Total paid", order.totalAmount, true);
    doc.moveDown(1).font("Helvetica").fontSize(9).fillColor("#555555")
      .text("Sales invoice for the order shown above. No GST has been charged.");
    doc.end();
  } catch (error) {
    console.error("Download invoice error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Unable to generate invoice" });
    else res.destroy(error);
  }
};

module.exports = {
  getMyOrders,
  getOrderById,
  cancelOrder,
  downloadInvoice,
};
