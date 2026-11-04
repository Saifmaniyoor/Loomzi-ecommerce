
const mongoose = require("mongoose");

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
        message: "Total amount must be an integer in paise",
      },
    },

    walletPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Wallet amount must be an integer in paise",
      },
    },

    razorpayPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Razorpay amount must be an integer in paise",
      },
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// CHECKOUT ATTEMPT SCHEMA
// =====================================================

const checkoutAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },

    // Prevents reusing the same checkout key
    // with different request details.
    requestHash: {
      type: String,
      required: true,
    },

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

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "Processing",
        "Creating Payment",
        "Ready",
        "Completed",
        "Failed",
        "Recovery Required",
      ],
      default: "Processing",
    },

    errorMessage: {
      type: String,
      default: null,
    },

    cartSnapshotHash: {
      type: String,
      default: null,
    },

    // Existing field.
    // Keep its current meaning for legacy
    // Razorpay checkout attempts.
    amountInPaise: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator(value) {
          return (
            value === null ||
            value === undefined ||
            Number.isSafeInteger(value)
          );
        },
        message: "Amount must be an integer in paise",
      },
    },

    // New field for wallet/split payments.
    // This stores the complete order amount
    // and the amount paid by each method.
    paymentBreakdown: {
      type: paymentBreakdownSchema,
      default: undefined,
    },

    currency: {
      type: String,
      default: "INR",
    },

    recoveryRazorpayOrderId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// VALIDATE PAYMENT BREAKDOWN
// =====================================================

checkoutAttemptSchema.pre("validate", function () {
  const breakdown = this.paymentBreakdown;

  // Allow existing checkout attempts
  // without payment breakdown data.
  if (!breakdown) {
    return;
  }

  const {
    totalPaise,
    walletPaise,
    razorpayPaise,
  } = breakdown;

  if (
    !Number.isSafeInteger(totalPaise) ||
    !Number.isSafeInteger(walletPaise) ||
    !Number.isSafeInteger(razorpayPaise) ||
    totalPaise < 1 ||
    walletPaise < 0 ||
    razorpayPaise < 0 ||
    walletPaise + razorpayPaise !== totalPaise
  ) {
    this.invalidate(
      "paymentBreakdown",
      "Invalid payment breakdown"
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
      "Invalid Razorpay-only payment breakdown"
    );
  }

  if (
    this.paymentMethod === "Wallet" &&
    (walletPaise !== totalPaise ||
      razorpayPaise !== 0)
  ) {
    this.invalidate(
      "paymentBreakdown",
      "Invalid wallet-only payment breakdown"
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

  // Existing amountInPaise is used by
  // Razorpay payment creation and confirmation.
  // For split payments, it must contain
  // only the Razorpay contribution.
  if (
    this.paymentMethod !== "COD" &&
    this.amountInPaise !== null &&
    this.amountInPaise !== undefined &&
    this.amountInPaise !== razorpayPaise
  ) {
    // Wallet-only checkout does not require
    // a Razorpay amount.
    if (
      this.paymentMethod !== "Wallet" ||
      this.amountInPaise !== totalPaise
    ) {
      this.invalidate(
        "amountInPaise",
        "Payment amount does not match payment method"
      );
    }
  }

  if (
    this.paymentMethod === "COD" &&
    (walletPaise !== 0 || razorpayPaise !== 0)
  ) {
    this.invalidate(
      "paymentBreakdown",
      "COD cannot have online payment contributions"
    );
  }
});

// =====================================================
// UNIQUE CHECKOUT IDEMPOTENCY INDEX
// =====================================================

// One checkout key per customer.
checkoutAttemptSchema.index(
  {
    user: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model(
  "CheckoutAttempt",
  checkoutAttemptSchema
);
