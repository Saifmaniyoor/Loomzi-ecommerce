
const crypto = require("node:crypto");

// Verify the Razorpay checkout payment signature.
const verifyRazorpaySignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  // 1. Validate required values
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(razorpayOrderId) ||
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(razorpayPaymentId) ||
    typeof razorpaySignature !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(razorpaySignature)
  ) {
    return false;
  }

  // 2. Read Razorpay secret from environment
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw new Error(
      "RAZORPAY_KEY_SECRET is not configured"
    );
  }

  // 3. Generate expected signature
  const message =
    `${razorpayOrderId}|${razorpayPaymentId}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest();

  // 4. Convert received signature to Buffer
  const receivedSignature = Buffer.from(
    razorpaySignature,
    "hex"
  );

  // 5. Compare signatures securely
  if (
    expectedSignature.length !==
    receivedSignature.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedSignature,
    receivedSignature
  );
};

module.exports = {
  verifyRazorpaySignature,
};
