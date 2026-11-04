
const mongoose = require("mongoose");

// ==========================================
// WEBHOOK EVENT SCHEMA
// ==========================================

// Stores Razorpay webhook events.
//
// IMPORTANT:
// Webhook signatures must be verified
// before events are registered.
//
// Supports Razorpay payments for:
// 1. Razorpay-only orders
// 2. Wallet + Razorpay orders
//
// Wallet-only orders do not require
// Razorpay payment webhooks.

const webhookEventSchema = new mongoose.Schema(
  {
    // Unique Razorpay webhook event ID
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 255,
    },

    // Example: payment.captured
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // Store the webhook payload only
    // after signature authentication.
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // Current processing state
    status: {
      type: String,
      enum: [
        "Received",
        "Processing",
        "Processed",
        "Failed",
        "Requires Reconciliation",
      ],
      default: "Received",
      required: true,
    },

    // Number of claim attempts
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message:
          "Webhook attempts must be a safe integer",
      },
    },

    // Last processing/reconciliation error
    lastError: {
      type: String,
      default: null,
      maxlength: 500,
    },

    // Set when processing completes
    processedAt: {
      type: Date,
      default: null,
    },

    // Set when a worker claims the event
    processingStartedAt: {
      type: Date,
      default: null,
    },

    // Unique ownership token for
    // the currently processing worker
    processingToken: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// INDEXES
// ==========================================

// eventId already has a unique index
// through unique: true.

// Helps find webhook events waiting
// for initial processing or recovery.
webhookEventSchema.index({
  status: 1,
  createdAt: 1,
});

// Helps identify interrupted processing
// events whose worker lease has expired.
webhookEventSchema.index({
  status: 1,
  processingStartedAt: 1,
});

// ==========================================
// EXPORT MODEL
// ==========================================

module.exports = mongoose.model(
  "WebhookEvent",
  webhookEventSchema
);
