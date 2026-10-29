
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { releaseStock } = require("../services/inventoryServices");
const razorpay = require("../config/razorpay");

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
const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.isObjectIdOrHexString(orderId)) {
    return res.status(400).json({ message: "Invalid order ID" });
  }

  const session = await mongoose.startSession();
  let cancelledOrder;
  let shouldRefund = false;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, user: req.user._id }).session(session);
      if (!order) {
        const e = new Error("Order not found"); e.statusCode = 404; throw e;
      }
      if (!["Pending", "Confirmed", "Processing"].includes(order.orderStatus)) {
        const e = new Error("This order can no longer be cancelled"); e.statusCode = 409; throw e;
      }
      const cod = order.paymentMethod === "COD" && order.paymentStatus === "Pending";
      const paidOnline = order.paymentMethod === "Razorpay" &&
        order.paymentStatus === "Paid" && !!order.razorpayPaymentId;
      if (!cod && !paidOnline) {
        const e = new Error("Payment is not eligible for cancellation. Contact support.");
        e.statusCode = 409; throw e;
      }
      // The order document is written in this transaction, so concurrent
      // cancellation attempts conflict rather than releasing stock twice.
      for (const item of order.items) {
        const product = await releaseStock({
          productId: item.product, variantId: item.variantId || null,
          quantity: item.quantity, session,
        });
        if (!product) throw new Error(`Unable to restore stock for ${item.name}`);
      }
      order.orderStatus = "Cancelled";
      order.statusHistory.push({ status: "Cancelled", note: "Cancelled by customer", updatedBy: "customer" });
      order.items.forEach((item) => { item.status = "Cancelled"; });
      shouldRefund = paidOnline;
      if (paidOnline) {
        order.refund = {
          status: "Initiating", amount: order.totalAmount,
          requestedAt: new Date(), note: "Customer cancellation",
        };
      }
      await order.save({ session });
      cancelledOrder = order.toObject();
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to cancel order",
    });
  } finally {
    await session.endSession();
  }

  if (shouldRefund) {
    try {
      const amount = Math.round(cancelledOrder.totalAmount * 100);
      const result = await razorpay.payments.refund(cancelledOrder.razorpayPaymentId, {
        amount,
        speed: "normal",
        notes: { orderId: String(cancelledOrder._id), reason: "Customer cancellation" },
      });
      const status = result.status === "processed" ? "Processed" : "Pending";
      await Order.updateOne(
        { _id: orderId, "refund.status": "Initiating" },
        { $set: {
          "refund.status": status,
          "refund.razorpayRefundId": result.id,
          "refund.note": "Razorpay refund accepted",
          ...(status === "Processed" ? { paymentStatus: "Refunded" } : {}),
        } },
      );
    } catch (error) {
      console.error("Refund initiation requires reconciliation:", error);
      await Order.updateOne(
        { _id: orderId, "refund.status": "Initiating" },
        { $set: { "refund.status": "Needs Review", "refund.note": "Check Razorpay before any retry" } },
      );
    }
  }
  const updated = await Order.findById(orderId).select("orderStatus paymentStatus refund").lean();
  return res.json({
    message: shouldRefund
      ? "Order cancelled. Check refund status for payment updates."
      : "Order cancelled successfully",
    order: { id: orderId, ...updated },
  });
};


module.exports = {
  getMyOrders,
  getOrderById,
  cancelOrder,
};
