const userServices = require("../services/userServices");

const requireUser = async (req, res, next) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Please login first",
      });
    }

    const user = await userServices.findUserById(userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found. Please login again",
      });
    }

console.log("Session User ID:", req.session.userId);
console.log("Customer Email:", user.email);
console.log("Verified:", user.isVerified);
console.log("Blocked:", user.isBlocked);

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email",
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: "Your account has been blocked",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Customer authentication error:", error);

    return res.status(500).json({
      message: "Authentication failed",
    });
  }
};

module.exports = requireUser;