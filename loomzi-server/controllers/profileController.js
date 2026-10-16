
const mongoose = require("mongoose");

const profileServices = require("../services/profileServices");

const bcrypt = require("bcrypt");

// =================================
// GET CUSTOMER PROFILE
// =================================
const getProfile = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await profileServices.findProfileById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Profile fetched successfully",
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// =================================
// UPDATE CUSTOMER PROFILE
// =================================
const updateProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { fullName, phone } = req.body || {};

    // Allow only fullName and phone
    const allowedFields = ["fullName", "phone"];
    const submittedFields = Object.keys(req.body || {});

    const hasInvalidFields = submittedFields.some(
      (field) => !allowedFields.includes(field)
    );

    if (hasInvalidFields) {
      return res.status(400).json({
        message: "Only full name and phone number can be updated",
      });
    }

    if (submittedFields.length === 0) {
      return res.status(400).json({
        message: "Please provide details to update",
      });
    }

    const updates = {};

    // Validate full name
    if (fullName !== undefined) {
      if (
        typeof fullName !== "string" ||
        fullName.trim().length < 2
      ) {
        return res.status(400).json({
          message: "Full name must contain at least 2 characters",
        });
      }

      updates.fullName = fullName.trim();
    }

    // Validate phone number
    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          message: "Invalid phone number",
        });
      }

      const normalizedPhone = phone.trim();

      if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
        return res.status(400).json({
          message: "Enter a valid 10-digit Indian phone number",
        });
      }

      // Check whether another customer uses this number
      const existingUser =
        await profileServices.findUserByPhone(normalizedPhone);

      if (
        existingUser &&
        existingUser._id.toString() !== userId.toString()
      ) {
        return res.status(409).json({
          message: "Phone number is already registered",
        });
      }

      updates.phone = normalizedPhone;
    }

    const updatedUser =
      await profileServices.updateProfileById(
        userId,
        updates
      );

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Phone number is already registered",
      });
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


const changePassword = async (req, res) => {
  try {
    const userId = req.session.userId;

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body || {};

    // Validate required fields
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "All password fields are required",
      });
    }

    // Validate new password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters",
      });
    }

    // Confirm new password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    // Fetch user with password
    const user =
      await profileServices.findUserWithPassword(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    // Prevent reusing the current password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // Update password in MongoDB
    await profileServices.updateUserPassword(
      userId,
      hashedPassword
    );

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


module.exports = {
  getProfile,
  updateProfile,
  changePassword,
};