const mongoose = require("mongoose");

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    eventType: {
      type: String,
      required: true,
      trim: true,
    },

    // Verified webhook payload.
    // Store only after signature verification.
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

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
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastError: {
      type: String,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    processingStartedAt: {
      type: Date,
      default: null,
    },

    processingToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
