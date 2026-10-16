
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const normalizeCheckoutRequest = ({
  addressId,
  couponCode,
}) => {
  if (!mongoose.isValidObjectId(addressId)) {
    throw new Error("Valid delivery address is required");
  }

  if (
    couponCode !== undefined &&
    couponCode !== null &&
    typeof couponCode !== "string"
  ) {
    throw new Error("Invalid coupon code");
  }

  const normalizedCoupon =
    (couponCode || "").trim().toUpperCase();

  if (
    normalizedCoupon &&
    !/^[A-Z0-9_-]{1,40}$/.test(normalizedCoupon)
  ) {
    throw new Error("Invalid coupon code");
  }

  return {
    addressId: String(addressId).toLowerCase(),
    couponCode: normalizedCoupon,
  };
};

const createRequestHash = (normalizedRequest) => {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalizedRequest))
    .digest("hex");
};

const validateIdempotencyKey = (key) => {
  if (
    typeof key !== "string" ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(key)
  ) {
    throw new Error(
      "Valid Idempotency-Key header is required"
    );
  }

  return key;
};

module.exports = {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
};
