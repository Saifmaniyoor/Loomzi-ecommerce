const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const client = new OAuth2Client();
const PHONE_REGEX = /^[6-9]\d{9}$/;
const PENDING_MS = 10 * 60 * 1000;

function saveSession(req, res, user) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ message: "Unable to create session" });
    req.session.userId = user._id.toString();
    req.session.save((error) => {
      if (error) return res.status(500).json({ message: "Unable to save session" });
      return res.json({ message: "Google login successful", user: {
        id: user._id, fullName: user.fullName, email: user.email
      }});
    });
  });
}

const googleLogin = async (req, res) => {
  try {
    const credential = req.body?.credential;
    const audience = process.env.GOOGLE_CLIENT_ID;
    if (!audience) return res.status(503).json({ message: "Google login is not configured" });
    if (typeof credential !== "string" || credential.length > 8192 || !credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }
    const ticket = await client.verifyIdToken({ idToken: credential, audience });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ message: "Google email is not verified" });
    }
    const email = payload.email.trim().toLowerCase();
    const user = await User.findOne({ googleId: payload.sub });
    if (user) {
      if (user.isBlocked) return res.status(403).json({ message: "Account blocked" });
      return saveSession(req, res, user);
    }
    // No automatic account linking. Existing password accounts remain separate.
    if (await User.exists({ email })) {
      return res.status(409).json({ message: "This email is already registered. Use your existing login." });
    }
    const fullName = (payload.name || email.split("@")[0]).trim().slice(0, 80);
    req.session.pendingGoogle = { sub: payload.sub, email, fullName, expires: Date.now() + PENDING_MS };
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Unable to save verification" });
      res.json({ needsPhone: true, email, fullName });
    });
  } catch (error) {
    console.error("Google sign-in error:", error.message);
    return res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }
};

const completeGoogleProfile = async (req, res) => {
  try {
    const pending = req.session?.pendingGoogle;
    if (!pending || pending.expires < Date.now()) {
      return res.status(401).json({ message: "Google verification expired. Sign in again." });
    }
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    if (!PHONE_REGEX.test(phone)) return res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
    if (await User.exists({ $or: [{ email: pending.email }, { googleId: pending.sub }] })) {
      return res.status(409).json({ message: "Account already exists. Please sign in again." });
    }
    if (await User.exists({ phone })) return res.status(409).json({ message: "Phone number already registered" });
    const user = await User.create({
      fullName: pending.fullName, email: pending.email, phone,
      googleId: pending.sub, isVerified: true
    });
    return saveSession(req, res, user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Email or phone number already registered" });
    console.error("Complete Google profile error:", error);
    return res.status(500).json({ message: "Unable to complete registration" });
  }
};

module.exports = { googleLogin, completeGoogleProfile };
