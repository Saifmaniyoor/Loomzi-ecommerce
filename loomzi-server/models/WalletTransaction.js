
const mongoose = require("mongoose");

// =====================================================
// WALLET TRANSACTION SCHEMA
// =====================================================

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    // =================================================
    // TRANSACTION TYPE
    // =================================================

    kind: {
      type: String,
      enum: [
        "cancellation_credit",
        "purchase_debit",
        "purchase_reversal",
        "purchase_reservation",
        "reservation_release",
      ],
      required: true,
    },

    // Always store money as integer paise.
    // Example: ₹400 = 40000 paise.
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message:
          "Wallet transaction amount must be a positive integer in paise",
      },
    },

    // Unique reference prevents the same
    // financial operation from being recorded twice.
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

// Wallet transaction history:
// newest transactions first.
walletTransactionSchema.index({
  user: 1,
  createdAt: -1,
});

// Helps locate transactions for an order.
walletTransactionSchema.index({
  order: 1,
  kind: 1,
});

// =====================================================
// EXPORT
// =====================================================

module.exports = mongoose.model(
  "WalletTransaction",
  walletTransactionSchema
);
