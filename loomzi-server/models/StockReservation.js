
const mongoose = require("mongoose");

const reservedItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const stockReservationSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [reservedItemSchema],
      validate: [
        (items) => items.length > 0,
        "Reservation must contain items",
      ],
    },

    status: {
      type: String,
      enum: ["Active", "Completed", "Released"],
      default: "Active",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    releasedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

stockReservationSchema.index({
  status: 1,
  expiresAt: 1,
});

module.exports = mongoose.model(
  "StockReservation",
  stockReservationSchema
);
