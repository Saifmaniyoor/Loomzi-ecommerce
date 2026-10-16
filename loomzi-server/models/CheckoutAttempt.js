const mongoose = require("mongoose");

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

    // Hash of the checkout request details.
    // Prevents reusing the same key with different input.
    requestHash: {
      type: String,
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

    amountInPaise: {
      type: Number,
      default: null,
      min: 1,
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
  },
);

// One checkout key per customer.
checkoutAttemptSchema.index(
  {
    user: 1,
    idempotencyKey: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("CheckoutAttempt", checkoutAttemptSchema);
