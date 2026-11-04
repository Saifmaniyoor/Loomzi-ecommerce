
const mongoose = require("mongoose");

// =====================================================
// ORDER ITEM SCHEMA
// =====================================================

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

    originalPrice: {
      type: Number,
      min: 0,
    },

    offerDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },

    appliedOffer: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      type: { type: String, default: null },
      discountPercentage: {
        type: Number,
        default: null,
      },
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
  { _id: true }
);

// =====================================================
// PAYMENT BREAKDOWN SCHEMA
// =====================================================

const paymentBreakdownSchema = new mongoose.Schema(
  {
    totalPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Total must be an integer in paise",
      },
    },

    walletPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Wallet amount must be an integer",
      },
    },

    razorpayPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Razorpay amount must be an integer",
      },
    },

    walletStatus: {
      type: String,
      enum: [
        "Not Used",
        "Reserved",
        "Settled",
        "Released",
      ],
      default: "Not Used",
    },
  },
  { _id: false }
);

// =====================================================
// ORDER SCHEMA
// =====================================================

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

    // =================================================
    // PAYMENT METHOD
    // =================================================

    paymentMethod: {
      type: String,
      enum: [
        "Razorpay",
        "COD",
        "Wallet",
        "Wallet+Razorpay",
      ],
      default: "Razorpay",
      required: true,
    },

    // Optional for compatibility with older orders.
    // New online orders must populate this.
    paymentBreakdown: {
      type: paymentBreakdownSchema,
      default: undefined,
    },

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refunded",
        "Partially Refunded",
      ],
      default: "Pending",
    },

    // =================================================
    // REFUND
    // =================================================

    refund: {
      status: {
        type: String,
        enum: [
          "Not Required",
          "Initiating",
          "Pending",
          "Processed",
          "Needs Review",
        ],
        default: "Not Required",
      },

      razorpayRefundId: {
        type: String,
        default: null,
      },

      destination: {
        type: String,
        enum: [
          "Razorpay",
          "Wallet",
        ],
        default: "Razorpay",
      },

      amount: {
        type: Number,
        default: 0,
      },

      requestedAt: {
        type: Date,
        default: null,
      },

      note: {
        type: String,
        default: "",
      },
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
    },

    // =================================================
    // TRACKING
    // =================================================

    tracking: {
      courier: {
        type: String,
        default: "",
        maxlength: 100,
      },

      trackingNumber: {
        type: String,
        default: "",
        maxlength: 120,
      },

      trackingUrl: {
        type: String,
        default: "",
        maxlength: 1000,
      },

      estimatedDelivery: {
        type: Date,
        default: null,
      },
    },

    statusHistory: [
      {
        status: {
          type: String,
          required: true,
        },

        note: {
          type: String,
          default: "",
          maxlength: 500,
        },

        changedAt: {
          type: Date,
          default: Date.now,
        },

        updatedBy: {
          type: String,
          enum: [
            "admin",
            "customer",
            "system",
          ],
          default: "admin",
        },
      },
    ],

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
  }
);

// =====================================================
// PAYMENT BREAKDOWN VALIDATION
// =====================================================

orderSchema.pre("validate", function () {
  const breakdown = this.paymentBreakdown;

  // Legacy orders do not require a breakdown.
  if (!breakdown) return;

  const {
    totalPaise,
    walletPaise,
    razorpayPaise,
    walletStatus,
  } = breakdown;

  const expectedTotalPaise = Math.round(
    this.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(expectedTotalPaise) ||
    expectedTotalPaise < 1
  ) {
    this.invalidate(
      "totalAmount",
      "Invalid order total"
    );
    return;
  }

  if (totalPaise !== expectedTotalPaise) {
    this.invalidate(
      "paymentBreakdown.totalPaise",
      "Payment total does not match order total"
    );
  }

  if (
    !Number.isSafeInteger(walletPaise) ||
    !Number.isSafeInteger(razorpayPaise) ||
    walletPaise < 0 ||
    razorpayPaise < 0 ||
    walletPaise + razorpayPaise !== totalPaise
  ) {
    this.invalidate(
      "paymentBreakdown",
      "Wallet and Razorpay amounts must equal order total"
    );
    return;
  }

  if (
    this.paymentMethod === "Razorpay" &&
    (walletPaise !== 0 ||
      razorpayPaise !== totalPaise)
  ) {
    this.invalidate(
      "paymentBreakdown",
      "Invalid Razorpay payment breakdown"
    );
  }

  if (
    this.paymentMethod === "Wallet" &&
    (walletPaise !== totalPaise ||
      razorpayPaise !== 0)
  ) {
    this.invalidate(
      "paymentBreakdown",
      "Invalid wallet payment breakdown"
    );
  }

  if (
    this.paymentMethod === "Wallet+Razorpay" &&
    (walletPaise <= 0 ||
      razorpayPaise < 100)
  ) {
    this.invalidate(
      "paymentBreakdown",
      "Split payment requires wallet funds and at least 100 paise through Razorpay"
    );
  }

  if (
    this.paymentMethod === "COD" &&
    (walletPaise !== 0 || razorpayPaise !== 0)
  ) {
    this.invalidate(
      "paymentBreakdown",
      "COD must not contain online payment contributions"
    );
  }

  if (
    walletPaise === 0 &&
    walletStatus !== "Not Used"
  ) {
    this.invalidate(
      "paymentBreakdown.walletStatus",
      "Wallet status must be Not Used"
    );
  }

  if (
    walletPaise > 0 &&
    walletStatus === "Not Used"
  ) {
    this.invalidate(
      "paymentBreakdown.walletStatus",
      "Wallet payment requires a wallet status"
    );
  }
});

// =====================================================
// UNIQUE RAZORPAY INDEXES
// =====================================================

orderSchema.index(
  { razorpayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: { $type: "string" },
    },
  }
);

orderSchema.index(
  { razorpayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("Order", orderSchema);
