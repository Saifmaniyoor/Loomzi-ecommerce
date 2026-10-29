const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const transporter = require("../config/mailer");

const emailValid = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const normalize = (value) => value.trim().toLowerCase();
const otp = () => String(crypto.randomInt(100000, 1000000));
const hashOtp = (value) => crypto.createHash("sha256").update(value).digest("hex");
const validPassword = (value) => typeof value === "string" && value.length >= 12 && value.length <= 128;
const generic = "If the email belongs to an active Super Admin, an OTP will be sent.";
const emailSender = () => process.env.EMAIL_USER;
const otpExpiry = () => new Date(Date.now() + 5 * 60 * 1000);

// For a multi-instance deployment, replace this local limiter with a shared Redis/store limiter.
const buckets = new Map();
function limited(req, res, key, max = 5, period = 15 * 60 * 1000) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
  const id = `${req.ip}:${key}`;
  let state = buckets.get(id);
  if (!state || state.until < now) state = { count: 0, until: now + period };
  state.count++;
  buckets.set(id, state);
  if (state.count > max) { res.status(429).json({ message: "Too many attempts. Try again later." }); return true; }
  return false;
}
async function sendOtp(to, code, subject) {
  await transporter.sendMail({ from: emailSender(), to, subject, text: `Your Loomzi Admin verification code is ${code}. It expires in 5 minutes. Never share this code.` });
}
function fail(res, err) {
  console.error("Admin security operation failed:", err);
  return res.status(err.code === 11000 ? 409 : 500).json({ message: err.code === 11000 ? "Email already in use" : "Unable to complete request" });
}
function signOut(req, res, message) {
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ message: "Credentials changed, but logout failed. Please close this browser and log in again." });
    res.clearCookie("loomzi.sid", { path: "/" });
    return res.json({ message });
  });
}
exports.getAccount = (req, res) => res.json({ email: req.admin.email, fullName: req.admin.fullName });

exports.requestReset = async (req, res) => {
  if (limited(req, res, "reset-request", 5)) return;
  const { email } = req.body || {};
  if (!emailValid(email)) return res.status(400).json({ message: "Enter a valid email" });
  try {
    const admin = await Admin.findOne({ email: normalize(email), role: "super_admin", isActive: true });
    if (admin) {
      const code = otp();
      await Admin.updateOne({ _id: admin._id }, { $set: { resetOtpHash: hashOtp(code), resetOtpExpiresAt: otpExpiry(), resetOtpAttempts: 0 } });
      try { await sendOtp(admin.email, code, "Loomzi Admin password reset"); }
      catch (err) { await Admin.updateOne({ _id: admin._id, resetOtpHash: hashOtp(code) }, { $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1 } }); throw err; }
    }
    return res.json({ message: generic });
  } catch (err) { console.error("Admin reset email failure", err); return res.json({ message: generic }); }
};

exports.verifyResetOtp = async (req, res) => {
  if (limited(req, res, "reset-verify", 12)) return;
  const { email, code } = req.body || {};
  if (!emailValid(email) || !/^\d{6}$/.test(code || "")) return res.status(400).json({ message: "Invalid email or OTP" });
  try {
    const admin = await Admin.findOne({ email: normalize(email), role: "super_admin", isActive: true }).select("+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts");
    if (!admin || !admin.resetOtpHash || !admin.resetOtpExpiresAt || admin.resetOtpExpiresAt <= new Date() || admin.resetOtpAttempts >= 5) return res.status(400).json({ message: "Invalid or expired OTP" });
    if (!crypto.timingSafeEqual(Buffer.from(admin.resetOtpHash), Buffer.from(hashOtp(code)))) {
      await Admin.updateOne({ _id: admin._id, resetOtpHash: admin.resetOtpHash }, { $inc: { resetOtpAttempts: 1 } });
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    return res.json({ message: "OTP verified. Set your new password." });
  } catch (err) { return fail(res, err); }
};

exports.resetPassword = async (req, res) => {
  if (limited(req, res, "reset-complete", 12)) return;
  const { email, code, newPassword, confirmPassword } = req.body || {};
  if (!emailValid(email) || !/^\d{6}$/.test(code || "") || !validPassword(newPassword) || newPassword !== confirmPassword) return res.status(400).json({ message: "Invalid details. Password must be 12–128 characters and match confirmation." });
  try {
    const admin = await Admin.findOne({ email: normalize(email), role: "super_admin", isActive: true }).select("+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts");
    if (!admin || !admin.resetOtpHash || !admin.resetOtpExpiresAt || admin.resetOtpExpiresAt <= new Date() || admin.resetOtpAttempts >= 5) return res.status(400).json({ message: "Invalid or expired OTP" });
    const hashedCode = hashOtp(code);
    if (!crypto.timingSafeEqual(Buffer.from(admin.resetOtpHash), Buffer.from(hashedCode))) {
      await Admin.updateOne({ _id: admin._id, resetOtpHash: admin.resetOtpHash }, { $inc: { resetOtpAttempts: 1 } });
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    const result = await Admin.updateOne({ _id: admin._id, resetOtpHash: hashedCode, resetOtpExpiresAt: { $gt: new Date() }, resetOtpAttempts: { $lt: 5 } }, { $set: { password: await bcrypt.hash(newPassword, 12) }, $inc: { credentialVersion: 1 }, $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1, resetOtpAttempts: 1 } });
    if (!result.modifiedCount) return res.status(409).json({ message: "OTP already used or expired" });
    return res.json({ message: "Password reset successful. Please log in." });
  } catch (err) { return fail(res, err); }
};

exports.changeCredentials = async (req, res) => {
  if (limited(req, res, "settings-change", 10)) return;
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  if (typeof currentPassword !== "string" || !currentPassword || !validPassword(newPassword) || newPassword !== confirmPassword) return res.status(400).json({ message: "Current password and a matching new password (12–128 characters) are required" });
  try {
    const admin = await Admin.findById(req.admin._id).select("+password");
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password))) return res.status(401).json({ message: "Incorrect current password" });
    const result = await Admin.updateOne({ _id: admin._id, credentialVersion: admin.credentialVersion ?? 0 }, { $set: { password: await bcrypt.hash(newPassword, 12) }, $inc: { credentialVersion: 1 }, $unset: { resetOtpHash: 1, resetOtpExpiresAt: 1, pendingEmail: 1, pendingEmailOtpHash: 1, pendingEmailOtpExpiresAt: 1 } });
    if (!result.modifiedCount) return res.status(409).json({ message: "Account changed. Please log in again." });
    return signOut(req, res, "Password changed. Please log in again.");
  } catch (err) { return fail(res, err); }
};

exports.sendEmailOtp = async (req, res) => {
  if (limited(req, res, "email-request", 5)) return;
  const { newEmail, currentPassword } = req.body || {};
  if (!emailValid(newEmail) || typeof currentPassword !== "string") return res.status(400).json({ message: "New email and current password required" });
  try {
    const admin = await Admin.findById(req.admin._id).select("+password");
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password))) return res.status(401).json({ message: "Incorrect current password" });
    const target = normalize(newEmail);
    if (target === admin.email) return res.status(400).json({ message: "New email must be different" });
    if (await Admin.exists({ email: target, _id: { $ne: admin._id } })) return res.status(409).json({ message: "Email already in use" });
    const code = otp();
    await Admin.updateOne({ _id: admin._id }, { $set: { pendingEmail: target, pendingEmailOtpHash: hashOtp(code), pendingEmailOtpExpiresAt: otpExpiry(), pendingEmailOtpAttempts: 0 } });
    await sendOtp(target, code, "Verify your new Loomzi Admin email");
    return res.json({ message: "Verification OTP sent to your new email" });
  } catch (err) { return fail(res, err); }
};

exports.verifyEmailOtp = async (req, res) => {
  if (limited(req, res, "email-verify", 12)) return;
  const { code, currentPassword } = req.body || {};
  if (!/^\d{6}$/.test(code || "") || typeof currentPassword !== "string") return res.status(400).json({ message: "OTP and current password required" });
  try {
    const admin = await Admin.findById(req.admin._id).select("+password +pendingEmail +pendingEmailOtpHash +pendingEmailOtpExpiresAt +pendingEmailOtpAttempts");
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password))) return res.status(401).json({ message: "Incorrect current password" });
    if (!admin.pendingEmail || !admin.pendingEmailOtpHash || admin.pendingEmailOtpExpiresAt <= new Date() || admin.pendingEmailOtpAttempts >= 5) return res.status(400).json({ message: "Invalid or expired OTP" });
    const hashedCode = hashOtp(code);
    if (!crypto.timingSafeEqual(Buffer.from(admin.pendingEmailOtpHash), Buffer.from(hashedCode))) {
      await Admin.updateOne({ _id: admin._id, pendingEmailOtpHash: admin.pendingEmailOtpHash }, { $inc: { pendingEmailOtpAttempts: 1 } });
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    const result = await Admin.updateOne({ _id: admin._id, pendingEmailOtpHash: hashedCode, pendingEmailOtpExpiresAt: { $gt: new Date() }, pendingEmailOtpAttempts: { $lt: 5 } }, { $set: { email: admin.pendingEmail }, $inc: { credentialVersion: 1 }, $unset: { pendingEmail: 1, pendingEmailOtpHash: 1, pendingEmailOtpExpiresAt: 1, pendingEmailOtpAttempts: 1, resetOtpHash: 1, resetOtpExpiresAt: 1 } });
    if (!result.modifiedCount) return res.status(409).json({ message: "OTP already used or expired" });
    return signOut(req, res, "Email updated. Please log in again.");
  } catch (err) { return fail(res, err); }
};
