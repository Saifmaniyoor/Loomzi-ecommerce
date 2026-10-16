
const mongoose = require("mongoose");

const storeSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },

    shippingCharge: {
      type: Number,
      required: true,
      default: 50,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "StoreSettings",
  storeSettingsSchema
);
