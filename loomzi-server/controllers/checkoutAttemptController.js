
const checkoutAttemptServices = require(
  "../services/checkoutAttemptServices"
);

const Wallet = require("../models/Wallet");

const {
  prepareOrderData,
} = require("../utils/checkoutPreparation");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

// =====================================================
// PAYMENT METHOD SELECTION
// =====================================================

const calculatePaymentMethod = ({
  totalPaise,
  walletBalancePaise,
  useWallet,
}) => {
  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid checkout total");
  }

  if (!useWallet || walletBalancePaise === 0) {
    return "Razorpay";
  }

  if (
    !Number.isSafeInteger(walletBalancePaise) ||
    walletBalancePaise < 0
  ) {
    throw new Error("Invalid wallet balance");
  }

  if (walletBalancePaise >= totalPaise) {
    return "Wallet";
  }

  // The remaining Razorpay amount must
  // be at least ₹1.
  //
  // When the remainder is below ₹1,
  // reserve slightly less wallet money.
  return "Wallet+Razorpay";
};

// =====================================================
// PREPARE CHECKOUT ATTEMPT
// =====================================================

const prepareCheckoutAttempt = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Validate idempotency key
    const idempotencyKey =
      validateIdempotencyKey(
        req.get("Idempotency-Key")
      );

    // 2. Normalize checkout request
    const normalizedRequest =
      normalizeCheckoutRequest(req.body || {});

    const requestHash =
      createRequestHash(normalizedRequest);

    // 3. Check whether this key already
    // belongs to an existing attempt.
    //
    // Reuse the existing payment method
    // rather than recalculating it using
    // a potentially changed wallet balance.
    const existingAttempt =
      await checkoutAttemptServices.findAttempt(
        userId,
        idempotencyKey
      );

    if (existingAttempt) {
      if (
        existingAttempt.requestHash !==
        requestHash
      ) {
        return res.status(409).json({
          message:
            "Idempotency key was already used for different checkout details",
        });
      }

      return res.status(200).json({
        message: "Checkout attempt already prepared",
        attemptId: existingAttempt._id,
        status: existingAttempt.status,
        orderId: existingAttempt.order,
        paymentMethod: existingAttempt.paymentMethod,
      });
    }

    // 4. Prepare trusted checkout data
    const orderData = await prepareOrderData({
      userId,
      addressId: normalizedRequest.addressId,
      couponCode: normalizedRequest.couponCode,
    });

    // 5. Read wallet balance
    const useWallet =
      normalizedRequest.useWallet === true;

    let walletBalancePaise = 0;

    if (useWallet) {
      const wallet = await Wallet.findOne({
        user: userId,
      }).select("balancePaise");

      walletBalancePaise =
        wallet?.balancePaise ?? 0;
    }

    // 6. Select payment method
    const paymentMethod =
      calculatePaymentMethod({
        totalPaise: orderData.amountInPaise,
        walletBalancePaise,
        useWallet,
      });

    // 7. Enforce LOOMZI10 coupon policy
    const couponCode =
      orderData.coupon?.code ||
      normalizedRequest.couponCode ||
      null;

    if (
      typeof couponCode === "string" &&
      couponCode.trim().toUpperCase() ===
        "LOOMZI10" &&
      paymentMethod === "Wallet"
    ) {
      return res.status(400).json({
        message:
          "LOOMZI10 requires Razorpay payment and cannot be used with wallet-only checkout",
      });
    }

    // 8. Create checkout attempt
    const attempt =
      await checkoutAttemptServices.findOrCreateAttempt({
        userId,
        idempotencyKey,
        requestHash,
        paymentMethod,
      });

    if (!attempt) {
      return res.status(500).json({
        message:
          "Unable to prepare checkout attempt",
      });
    }

    // 9. Return prepared attempt
    return res.status(200).json({
      message: "Checkout attempt prepared",
      attemptId: attempt._id,
      status: attempt.status,
      orderId: attempt.order,
      paymentMethod: attempt.paymentMethod,
    });
  } catch (error) {
    // Known validation errors
    if (
      error.message ===
        "Valid Idempotency-Key header is required" ||
      error.message ===
        "Valid delivery address is required" ||
      error.message === "Invalid coupon code" ||
      error.message === "Invalid checkout total" ||
      error.message === "Invalid wallet balance"
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Idempotency conflict
    if (
      error.message?.includes(
        "Idempotency key was used"
      )
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    console.error(
      "Prepare checkout attempt error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to prepare checkout attempt",
    });
  }
};

module.exports = {
  prepareCheckoutAttempt,
};
