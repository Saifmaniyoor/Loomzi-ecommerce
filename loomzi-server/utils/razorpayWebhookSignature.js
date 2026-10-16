
const crypto = require("node:crypto");

// Verify Razorpay webhook signature using
// the original raw request body.
const verifyRazorpayWebhookSignature = ({
  rawBody,
  signature,
}) => {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  if (
    typeof webhookSecret !== "string" ||
    webhookSecret.length === 0
  ) {
    throw new Error(
      "Razorpay webhook secret is not configured"
    );
  }

  // Razorpay signs the raw request body.
  // Do not use JSON.stringify(req.body).
  if (!Buffer.isBuffer(rawBody)) {
    return false;
  }

  if (
    typeof signature !== "string" ||
    !/^[a-fA-F0-9]{64}$/.test(signature)
  ) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest();

  const receivedSignature = Buffer.from(
    signature,
    "hex"
  );

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
  verifyRazorpayWebhookSignature,
};
