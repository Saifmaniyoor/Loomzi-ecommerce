const bcrypt = require("bcrypt");

const crypto = require("node:crypto");

const userServices = require("../services/userServices");

const transporter = require("../config/mailer");

// =====================================

// REGISTER USER

// =====================================

const registerUser = async (req, res) => {
  try {
    console.log("STEP 1: Registration request received");

    const {
      fullName,

      email,

      phone,

      password,

      confirmPassword,
    } = req.body || {};

    // 1. Validate required fields

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof phone !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string" ||
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // 2. Validate email

    const normalizedEmail = email.trim().toLowerCase();

    const normalizedPhone = phone.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    // 3. Validate phone

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Please enter a valid 10-digit phone number",
      });
    }

    // 4. Validate password

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    console.log("STEP 2: Validation completed");

    // 5. Check existing email

    const existingEmail = await userServices.findUserByEmail(normalizedEmail);

    if (existingEmail) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    // 6. Check existing phone

    const existingPhone = await userServices.findUserByPhone(normalizedPhone);

    if (existingPhone) {
      return res.status(409).json({
        message: "Phone number already registered",
      });
    }

    console.log("STEP 3: Duplicate checks completed");

    // 7. Hash password

    const hashedPassword = await bcrypt.hash(password, 10);

    // 8. Generate secure 6-digit OTP

    const otp = crypto.randomInt(100000, 1000000).toString();

    // 9. OTP expires in 5 minutes

    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    const otpResendAvailableAt = otpExpires;

    // 10. Hash OTP

    const hashedOtp = await bcrypt.hash(otp, 10);

    console.log("STEP 4: Password and OTP prepared");

    // 11. Save user to MongoDB

    const user = await userServices.createUser({
      fullName: fullName.trim(),

      email: normalizedEmail,

      phone: normalizedPhone,

      password: hashedPassword,

      otp: hashedOtp,

      otpExpires,
      otpResendAvailableAt,

      isVerified: false,
    });

    console.log("STEP 5: User saved successfully");

    // 12. Send OTP email

    try {
      const emailInfo = await transporter.sendMail({
        from: process.env.EMAIL_USER,

        to: user.email,

        subject: "Verify your Loomzi account",

        text: `Your Loomzi verification code is ${otp}. This code will expire in 5 minutes.`,
      });

      console.log("STEP 6: OTP email accepted by SMTP");

      console.log("Message ID:", emailInfo.messageId);
    } catch (emailError) {
      console.error("OTP EMAIL ERROR:", emailError);

      return res.status(502).json({
        message:
          "Account created, but verification email could not be sent. Please request a new OTP.",
      });
    }

    console.log("STEP 7: Registration completed successfully");

    return res.status(201).json({
      message: "Registration successful. Please verify your email.",

      user: {
        id: user._id,

        fullName: user.fullName,

        email: user.email,

        phone: user.phone,

        isVerified: user.isVerified,
      },
      resendAvailableAt: otpResendAvailableAt.toISOString(),
    });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email or phone already registered",
      });
    }

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================

// VERIFY OTP

// =====================================

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    // 1. Validate input

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !email.trim() ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        message: "Valid email and 6-digit OTP are required",
      });
    }

    // 2. Find registered user

    const user = await userServices.findUserByEmail(email.trim().toLowerCase());

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // 3. Check verification status

    if (user.isVerified) {
      return res.status(400).json({
        message: "Email already verified",
      });
    }

    // 4. Check OTP expiry

    if (
      !user.otp ||
      !user.otpExpires ||
      user.otpExpires.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "OTP expired. Please request a new OTP.",
      });
    }

    // 5. Compare OTP

    const isValidOtp = await bcrypt.compare(
      otp,

      user.otp,
    );

    if (!isValidOtp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // 6. Mark email as verified

    await userServices.markEmailVerified(user._id);

    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("OTP verification error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================

// LOGIN USER WITH SESSION

// =====================================

// Resend verification OTP. The database condition prevents concurrent early requests.
const resendOtp = async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Valid email is required" });
    }
    const User = require("../models/User");
    const now = new Date();
    const nextAllowed = new Date(now.getTime() + 5 * 60 * 1000);
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const user = await User.findOneAndUpdate(
      { email, isVerified: false,
        $or: [{ otpResendAvailableAt: { $lte: now } }, { otpResendAvailableAt: null }] },
      { $set: { otp: hashedOtp, otpExpires: nextAllowed, otpResendAvailableAt: nextAllowed } },
      { new: true }
    );
    if (!user) {
      const existing = await User.findOne({ email });
      if (!existing) return res.status(404).json({ message: "User not found" });
      if (existing.isVerified) return res.status(400).json({ message: "Email already verified" });
      const remaining = Math.max(1, Math.ceil((new Date(existing.otpResendAvailableAt).getTime() - Date.now()) / 1000));
      res.set("Retry-After", String(remaining));
      return res.status(429).json({ message: "Please wait before resending OTP", retryAfterSeconds: remaining,
        resendAvailableAt: existing.otpResendAvailableAt });
    }
    try {
      await transporter.sendMail({ from: process.env.EMAIL_USER, to: email,
        subject: "Verify your Loomzi account",
        text: `Your Loomzi verification code is ${otp}. This code will expire in 5 minutes.` });
    } catch (err) {
      console.error("RESEND OTP EMAIL ERROR:", err);
      return res.status(502).json({ message: "Unable to send OTP email. Please try again later.", resendAvailableAt: nextAllowed });
    }
    return res.status(200).json({ message: "A new OTP has been sent", resendAvailableAt: nextAllowed.toISOString() });
  } catch (error) {
    console.error("RESEND OTP ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 1. Validate input

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // 2. Find user in MongoDB

    const user = await userServices.findUserForLogin(
      email.trim().toLowerCase(),
    );

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 3. Compare password

    const isPasswordValid = await bcrypt.compare(
      password,

      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 4. Check email verification

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in",
      });
    }

    // 5. Check whether customer is blocked
    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    // 5. Create a new session

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session error:", err);

        return res.status(500).json({
          message: "Unable to create login session",
        });
      }

      // Store user ID in session

      req.session.userId = user._id.toString();

      // 6. Save session to MongoDB

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);

          return res.status(500).json({
            message: "Unable to save login session",
          });
        }

        // 7. Login successful

        return res.status(200).json({
          message: "Login successful",

          user: {
            id: user._id,

            fullName: user.fullName,

            email: user.email,
          },
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Server error. Please try again.",
    });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    // Check whether the user has a session

    if (!req.session.userId) {
      return res.status(401).json({
        message: "Not logged in",
      });
    }

    // Find logged-in user in MongoDB

    const user = await userServices.findUserById(req.session.userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (user.isBlocked === true) {
  return res.status(403).json({
    success: false,
    message: "Your account has been blocked. Please contact support.",
  });
}

    return res.status(200).json({
      user: {
        id: user._id,

        fullName: user.fullName,

        email: user.email,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

const logoutUser = (req, res) => {
  if (!req.session) {
    return res.status(401).json({
      message: "No active session",
    });
  }

  // Destroy session in MongoDB

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);

      return res.status(500).json({
        message: "Logout failed",
      });
    }

    // Remove session cookie from browser

    res.clearCookie("loomzi.sid", {
      httpOnly: true,

      secure: false,

      sameSite: "lax",

      path: "/",
    });

    return res.status(200).json({
      message: "Logout successful",
    });
  });
};

// =====================================

// FORGOT PASSWORD - SEND OTP

// =====================================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    // Validate email

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find registered user

    const user = await userServices.findUserByEmail(normalizedEmail);

    // Use the same response for registered and

    // unregistered emails to protect account privacy.

    const successMessage =
      "If this email is registered, a password reset OTP has been sent.";

    if (!user) {
      return res.status(200).json({
        message: successMessage,
      });
    }

    // Generate six-digit OTP

    const otp = crypto
      .randomInt(
        100000,

        1000000,
      )
      .toString();

    // Hash OTP before saving

    const hashedOtp = await bcrypt.hash(otp, 10);

    // OTP valid for 5 minutes

    await userServices.savePasswordResetOtp(
      user._id,
      hashedOtp,
      new Date(Date.now() + 5 * 60 * 1000),
    );

    // Send OTP email

    await transporter.sendMail({
      from: process.env.EMAIL_USER,

      to: user.email,

      subject: "Loomzi - Reset Your Password",

      text:
        `Your Loomzi password reset OTP is ${otp}. ` +
        "This code expires in 5 minutes. " +
        "If you did not request this, ignore this email.",
    });

    return res.status(200).json({
      message: successMessage,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return res.status(500).json({
      message: "Unable to process request. Please try again.",
    });
  }
};

// =====================================

// VERIFY PASSWORD RESET OTP

// =====================================

const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};

    // 1. Validate input

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      !email.trim() ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        message: "Valid email and 6-digit OTP are required",
      });
    }

    // 2. Find user

    const user = await userServices.findUserByEmail(email.trim().toLowerCase());

    if (
      !user ||
      !user.resetOtp ||
      !user.resetOtpExpires ||
      user.resetOtpExpires.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // 3. Compare OTP with stored hash

    const isValid = await bcrypt.compare(
      otp,

      user.resetOtp,
    );

    if (!isValid) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // 4. Generate secure password reset token

    const resetToken = crypto

      .randomBytes(32)

      .toString("hex");

    // 5. Store only the token hash

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store reset token and remove used OTP
    await userServices.savePasswordResetToken(
      user._id,
      resetTokenHash,
      new Date(Date.now() + 10 * 60 * 1000),
    );

    // 7. Return token for next reset step

    return res.status(200).json({
      message: "OTP verified successfully",

      resetToken,
    });
  } catch (error) {
    console.error("Reset OTP verification error:", error);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

// =====================================

// RESET PASSWORD

// =====================================

const resetPassword = async (req, res) => {
  try {
    const {
      email,

      resetToken,

      newPassword,

      confirmPassword,
    } = req.body || {};

    // 1. Validate request

    if (
      typeof email !== "string" ||
      typeof resetToken !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !email.trim() ||
      !/^[a-f0-9]{64}$/.test(resetToken) ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        message: "Invalid password reset request",
      });
    }

    // 2. Validate password length

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    // 3. Confirm passwords match

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // 4. Hash the reset token received from frontend

    const tokenHash = crypto

      .createHash("sha256")

      .update(resetToken)

      .digest("hex");

    // 5. Find user with valid reset token

    const user = await userServices.findUserByValidResetToken(
      email.trim().toLowerCase(),
      tokenHash,
    );

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link. Please request a new OTP.",
      });
    }

    // 6. Check that new password differs from current password

    const isSamePassword = await bcrypt.compare(
      newPassword,

      user.password,
    );

    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from your current password",
      });
    }

    // 7. Hash new password

    const hashedPassword = await bcrypt.hash(
      newPassword,

      10,
    );

    // 8. Update password and invalidate reset token

    // Conditional update ensures the same token

    // cannot successfully reset the password twice.

    const updatedUser = await userServices.updatePasswordWithValidToken(
      user._id,
      tokenHash,
      hashedPassword,
    );

    if (!updatedUser) {
      return res.status(400).json({
        message: "Reset token has expired or already been used",
      });
    }

    return res.status(200).json({
      message:
        "Password reset successful. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      message: "Server error. Please try again.",
    });
  }
};

// =====================================

// EXPORT CONTROLLERS

// =====================================

module.exports = {
  resendOtp,
  registerUser,

  verifyOtp,

  loginUser,

  getCurrentUser,

  logoutUser,

  forgotPassword,

  verifyResetOtp,

  resetPassword,
};
