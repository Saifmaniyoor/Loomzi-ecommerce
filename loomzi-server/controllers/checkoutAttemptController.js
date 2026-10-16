
const checkoutAttemptServices = require(
  "../services/checkoutAttemptServices"
);

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

const prepareCheckoutAttempt = async (req, res) => {
  try {
    const userId = req.user._id;

    const idempotencyKey = validateIdempotencyKey(
      req.get("Idempotency-Key")
    );

    const normalizedRequest =
      normalizeCheckoutRequest(req.body || {});

    const requestHash =
      createRequestHash(normalizedRequest);

    const attempt =
      await checkoutAttemptServices.findOrCreateAttempt({
        userId,
        idempotencyKey,
        requestHash,
      });

    if (!attempt) {
      return res.status(500).json({
        message: "Unable to prepare checkout attempt",
      });
    }

    if (attempt.requestHash !== requestHash) {
      return res.status(409).json({
        message:
          "Idempotency key was already used for different checkout details",
      });
    }

    return res.status(200).json({
      message: "Checkout attempt prepared",
      attemptId: attempt._id,
      status: attempt.status,
      orderId: attempt.order,
    });
  } catch (error) {
    if (
      error.message ===
        "Valid Idempotency-Key header is required" ||
      error.message ===
        "Valid delivery address is required" ||
      error.message === "Invalid coupon code"
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Prepare checkout attempt error:", error);

    return res.status(500).json({
      message: "Failed to prepare checkout attempt",
    });
  }
};

module.exports = {
  prepareCheckoutAttempt,
};
