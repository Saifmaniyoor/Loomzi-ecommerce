
const shippingSettingsServices = require(
  "../services/shippingSettingsServices"
);

// GET /api/admin/settings/shipping
const getShippingCharge = async (req, res) => {
  try {
    const settings =
      await shippingSettingsServices.getStoreSettings();

    return res.status(200).json({
      message: "Shipping settings fetched successfully",
      shippingCharge: settings?.shippingCharge ?? 50,
    });
  } catch (error) {
    console.error("Get shipping settings error:", error);

    return res.status(500).json({
      message: "Failed to fetch shipping settings",
    });
  }
};

// PATCH /api/admin/settings/shipping
const updateShippingCharge = async (req, res) => {
  try {
    const { shippingCharge } = req.body || {};

    if (
      typeof shippingCharge !== "number" ||
      !Number.isFinite(shippingCharge) ||
      shippingCharge < 0
    ) {
      return res.status(400).json({
        message:
          "Shipping charge must be a valid non-negative number",
      });
    }

    const settings =
      await shippingSettingsServices.updateShippingCharge(
        shippingCharge
      );

    return res.status(200).json({
      message: "Shipping charge updated successfully",
      shippingCharge: settings.shippingCharge,
    });
  } catch (error) {
    console.error("Update shipping settings error:", error);

    return res.status(500).json({
      message: "Failed to update shipping settings",
    });
  }
};

module.exports = {
  getShippingCharge,
  updateShippingCharge,
};
