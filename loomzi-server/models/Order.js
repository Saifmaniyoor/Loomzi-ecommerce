const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      default: "",
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    color: {
      type: String,
      default: "",
    },

    size: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    originalPrice: { type: Number, min: 0 },
    offerDiscount: { type: Number, default: 0, min: 0 },
    appliedOffer: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      type: { type: String, default: null },
      discountPercentage: { type: Number, default: null },
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Return Requested",
        "Returned",
      ],
      default: "Pending",
    },
  },
  { _id: true },
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    items: {
      type: [orderItemSchema],
      validate: [
        (items) => items.length > 0,
        "Order must contain at least one item",
      ],
    },

    shippingAddress: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    coupon: {
      code: {
        type: String,
        default: null,
      },

      discountAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    shippingCharge: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
    },

    tax: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["Razorpay", "COD"],
      default: "Razorpay",
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded", "Partially Refunded"],
      default: "Pending",
    },

    refund: {
      status: { type: String, enum: ["Not Required", "Initiating", "Pending", "Processed", "Needs Review"], default: "Not Required" },
      razorpayRefundId: { type: String, default: null },
      amount: { type: Number, default: 0 },
      requestedAt: { type: Date, default: null },
      note: { type: String, default: "" },
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    tracking: {
      courier: { type: String, default: "", maxlength: 100 },
      trackingNumber: { type: String, default: "", maxlength: 120 },
      trackingUrl: { type: String, default: "", maxlength: 1000 },
      estimatedDelivery: { type: Date, default: null },
    },
    statusHistory: [{
      status: { type: String, required: true },
      note: { type: String, default: "", maxlength: 500 },
      changedAt: { type: Date, default: Date.now },
      updatedBy: { type: String, enum: ["admin", "customer", "system"], default: "admin" },
    }],

    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate Razorpay order IDs
orderSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $type: "string" },
    },
  },
);

orderSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string" },
    },
  },
);

module.exports = mongoose.model("Order", orderSchema);
