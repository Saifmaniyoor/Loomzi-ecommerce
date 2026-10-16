
const StoreSettings = require("../models/StoreSettings");

// Validate shipping charge inside checkout transaction.
const validateShippingForCheckout = async ({
  expectedShippingCharge,
  session,
}) => {
  if (!session) {
    throw new Error(
      "Shipping validation requires a transaction"
    );
  }

  if (
    typeof expectedShippingCharge !== "number" ||
    !Number.isFinite(expectedShippingCharge) ||
    expectedShippingCharge < 0
  ) {
    throw new Error("Invalid shipping charge");
  }

  // Find the global settings and perform a write
  // to coordinate with concurrent admin updates.
  const settings = await StoreSettings.findOneAndUpdate(
    {
      key: "global",
    },
    {
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      new: true,
      session,
    }
  );

  // Match cartCalculator's default shipping policy
  // when the settings document does not exist.
  const currentShippingCharge =
    settings?.shippingCharge ?? 50;

  if (
    !Number.isFinite(currentShippingCharge) ||
    currentShippingCharge < 0
  ) {
    throw new Error("Invalid store shipping settings");
  }

  const expectedPaise = Math.round(
    expectedShippingCharge * 100
  );

  const currentPaise = Math.round(
    currentShippingCharge * 100
  );

  if (expectedPaise !== currentPaise) {
    throw new Error(
      "Shipping charge changed. Please refresh checkout."
    );
  }

  return currentShippingCharge;
};

module.exports = {
  validateShippingForCheckout,
};
