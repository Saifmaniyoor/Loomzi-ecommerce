
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
      user: { ...user.toObject(), isGoogleAccount: Boolean(user.googleId), googleId: undefined },
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



// Email-change OTP is separate from registration/password-reset OTP.
const User = require("../models/User");
const transporter = require("../config/mailer");
const crypto = require("node:crypto");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL = 10 * 60 * 1000;
const RESEND_WAIT = 5 * 60 * 1000;
const otpHash = (userId, email, otp) => crypto.createHmac("sha256", process.env.SESSION_SECRET).update(`${userId}:${email}:${otp}`).digest("hex");

const requestEmailChange = async (req, res) => {
  try {
    if (!process.env.SESSION_SECRET) return res.status(503).json({message:"Email verification is not configured"});
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) return res.status(400).json({message:"Enter a valid email address"});
    const user = await User.findById(req.session.userId).select("+emailChangeOtpHash");
    if (!user) return res.status(401).json({message:"Please log in again"});
    if (email === user.email) return res.status(400).json({message:"Enter a different email address"});
    if (user.emailChangeResendAt && user.emailChangeResendAt > new Date()) return res.status(429).json({message:"Please wait 5 minutes before requesting another OTP"});
    if (await User.exists({email, _id:{$ne:user._id}})) return res.status(409).json({message:"Email already registered"});
    // Password users must confirm their current password before requesting a change.
    if (!user.googleId) {
      const passwordUser = await User.findById(user._id).select("+password");
      if (typeof req.body?.currentPassword !== "string" || !await bcrypt.compare(req.body.currentPassword, passwordUser.password)) return res.status(401).json({message:"Current password is incorrect"});
    } else {
      // For Google accounts require a fresh verified Google ID token, not only a session.
      const {OAuth2Client} = require("google-auth-library");
      const credential = req.body?.googleCredential;
      if (typeof credential !== "string" || !process.env.GOOGLE_CLIENT_ID) return res.status(401).json({message:"Please verify your Google account again"});
      let payload;
      try { payload = (await new OAuth2Client().verifyIdToken({idToken:credential,audience:process.env.GOOGLE_CLIENT_ID})).getPayload(); } catch { return res.status(401).json({message:"Google verification failed"}); }
      if (!payload || payload.sub !== user.googleId || !payload.email_verified) return res.status(401).json({message:"Google account does not match"});
      if (!payload.iat || Date.now()/1000 - payload.iat > 300) return res.status(401).json({message:"Please sign in to Google again"});
    }
    const otp = crypto.randomInt(100000,1000000).toString();
    user.pendingEmail = email;
    user.emailChangeOtpHash = otpHash(user._id,email,otp);
    user.emailChangeOtpExpires = new Date(Date.now()+OTP_TTL);
    user.emailChangeResendAt = new Date(Date.now()+RESEND_WAIT);
    user.emailChangeAttempts = 0;
    await user.save();
    try {
      await transporter.sendMail({from:process.env.EMAIL_USER,to:email,subject:"Loomzi - Verify your new email",text:`Your Loomzi email change OTP is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`});
    } catch (error) {
      await User.updateOne({_id:user._id,emailChangeOtpHash:user.emailChangeOtpHash},{$set:{pendingEmail:null,emailChangeOtpHash:null,emailChangeOtpExpires:null,emailChangeResendAt:null,emailChangeAttempts:0}});
      console.error("Email change delivery failed",error);
      return res.status(502).json({message:"Unable to send verification email. Please try again."});
    }
    return res.json({message:"Verification code sent to your new email address"});
  } catch(error) {console.error("Request email change",error);return res.status(500).json({message:"Unable to request email change"});}
};

const verifyEmailChange = async (req,res) => {
  try {
    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({message:"Enter the 6-digit OTP"});
    const user = await User.findById(req.session.userId).select("+emailChangeOtpHash");
    if (!user || !user.pendingEmail || !user.emailChangeOtpHash) return res.status(400).json({message:"Request a new OTP first"});
    if (!user.emailChangeOtpExpires || user.emailChangeOtpExpires < new Date()) return res.status(400).json({message:"OTP expired. Request a new code."});
    if (user.emailChangeAttempts >= 5) return res.status(429).json({message:"Too many attempts. Request a new code."});
    const expected = Buffer.from(user.emailChangeOtpHash,"hex");
    const supplied = Buffer.from(otpHash(user._id,user.pendingEmail,otp),"hex");
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected,supplied)) {
      await User.updateOne({_id:user._id},{$inc:{emailChangeAttempts:1}});
      return res.status(400).json({message:"Invalid OTP"});
    }
    const oldEmail=user.email,newEmail=user.pendingEmail;
    const updated = await User.findOneAndUpdate({_id:user._id,pendingEmail:newEmail,emailChangeOtpHash:user.emailChangeOtpHash,emailChangeOtpExpires:{$gt:new Date()}},{$set:{email:newEmail,pendingEmail:null,emailChangeOtpHash:null,emailChangeOtpExpires:null,emailChangeResendAt:null,emailChangeAttempts:0}},{new:true,runValidators:true});
    if (!updated) return res.status(409).json({message:"Verification expired. Try again."});
    // Notification is best-effort; successful update should not be undone by mail failure.
    transporter.sendMail({from:process.env.EMAIL_USER,to:oldEmail,subject:"Your Loomzi email was changed",text:`Your Loomzi account email was changed to ${newEmail}. If this was not you, contact Loomzi support immediately.`}).catch(err=>console.error("Email change notice failed",err));
    return res.json({message:"Email address updated successfully",email:newEmail});
  } catch(error) {
    if(error.code===11000) return res.status(409).json({message:"Email already registered"});
    console.error("Verify email change",error);return res.status(500).json({message:"Unable to change email"});
  }
};

module.exports = {
  requestEmailChange,
  verifyEmailChange,
  getProfile,
  updateProfile,
  changePassword,
};