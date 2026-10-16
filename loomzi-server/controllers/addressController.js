
const mongoose = require("mongoose");
const addressServices = require("../services/addressServices");

const allowedFields = [
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "landmark",
  "city",
  "state",
  "pincode",
  "addressType",
];

const requiredFields = [
  "fullName",
  "phone",
  "addressLine1",
  "city",
  "state",
  "pincode",
];

const validateAddress = (data) => {
  for (const field of requiredFields) {
    if (
      typeof data[field] !== "string" ||
      !data[field].trim()
    ) {
      return `${field} is required`;
    }
  }

  if (!/^[6-9]\d{9}$/.test(data.phone)) {
    return "Enter a valid 10-digit phone number";
  }

  if (!/^\d{6}$/.test(data.pincode)) {
    return "Enter a valid 6-digit pincode";
  }

  if (
    data.addressType &&
    !["Home", "Work", "Other"].includes(data.addressType)
  ) {
    return "Invalid address type";
  }

  return null;
};

const getAddresses = async (req, res) => {
  try {
    const addresses =
      await addressServices.findAddressesByUser(
        req.session.userId
      );

    return res.status(200).json({
      addresses,
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const input = req.body || {};

    const data = {};

    for (const field of allowedFields) {
      if (input[field] !== undefined) {
        data[field] =
          typeof input[field] === "string"
            ? input[field].trim()
            : input[field];
      }
    }

    const validationError = validateAddress(data);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const count =
      await addressServices.countUserAddresses(userId);

    const address = await addressServices.createAddress({
      ...data,
      user: userId,
      isDefault: count === 0,
    });

    return res.status(201).json({
      message: "Address added successfully",
      address,
    });
  } catch (error) {
    console.error("Add address error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;

    if (!mongoose.isValidObjectId(addressId)) {
      return res.status(400).json({
        message: "Invalid address ID",
      });
    }

    const existing =
      await addressServices.findAddressById(
        userId,
        addressId
      );

    if (!existing) {
      return res.status(404).json({
        message: "Address not found",
      });
    }

    const input = req.body || {};
    const updates = {};

    for (const field of allowedFields) {
      if (input[field] !== undefined) {
        updates[field] =
          typeof input[field] === "string"
            ? input[field].trim()
            : input[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided",
      });
    }

    const merged = {
      ...existing.toObject(),
      ...updates,
    };

    const validationError = validateAddress(merged);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const address =
      await addressServices.updateAddress(
        userId,
        addressId,
        updates
      );

    return res.status(200).json({
      message: "Address updated successfully",
      address,
    });
  } catch (error) {
    console.error("Update address error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;

    if (!mongoose.isValidObjectId(addressId)) {
      return res.status(400).json({
        message: "Invalid address ID",
      });
    }

    const existing =
      await addressServices.findAddressById(
        userId,
        addressId
      );

    if (!existing) {
      return res.status(404).json({
        message: "Address not found",
      });
    }

    const wasDefault = existing.isDefault;

    await addressServices.deleteAddress(
      userId,
      addressId
    );

    if (wasDefault) {
      const next =
        await addressServices.findNewestAddress(userId);

      if (next) {
        await addressServices.updateAddress(
          userId,
          next._id,
          { isDefault: true }
        );
      }
    }

    return res.status(200).json({
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressId = req.params.id;

    if (!mongoose.isValidObjectId(addressId)) {
      return res.status(400).json({
        message: "Invalid address ID",
      });
    }

    const existing =
      await addressServices.findAddressById(
        userId,
        addressId
      );

    if (!existing) {
      return res.status(404).json({
        message: "Address not found",
      });
    }

    if (existing.isDefault) {
      return res.status(200).json({
        message: "Address is already the default",
        address: existing,
      });
    }

    await addressServices.clearDefaultAddress(userId);

    const address =
      await addressServices.updateAddress(
        userId,
        addressId,
        { isDefault: true }
      );

    return res.status(200).json({
      message: "Default address updated successfully",
      address,
    });
  } catch (error) {
    console.error("Set default address error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
