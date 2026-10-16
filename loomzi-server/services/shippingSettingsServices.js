
const StoreSettings = require("../models/StoreSettings");

// Get global store settings
const getStoreSettings = async () => {
  return StoreSettings.findOne({ key: "global" });
};

// Create or update shipping settings
const updateShippingCharge = async (shippingCharge) => {
  return StoreSettings.findOneAndUpdate(
    { key: "global" },
    {
      $set: { shippingCharge },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    }
  );
};

module.exports = {
  getStoreSettings,
  updateShippingCharge,
};
