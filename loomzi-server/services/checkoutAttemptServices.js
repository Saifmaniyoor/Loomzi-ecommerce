
const mongoose = require("mongoose");

const CheckoutAttempt = require("../models/CheckoutAttempt");

// ======================================
// PAYMENT METHOD HELPERS
// ======================================

const PAYMENT_METHODS = [
  "Razorpay",
  "COD",
  "Wallet",
  "Wallet+Razorpay",
];

const RAZORPAY_METHODS = [
  "Razorpay",
  "Wallet+Razorpay",
];

const isRazorpayMethod = (method) =>
  RAZORPAY_METHODS.includes(method);

const validatePaymentMethod = (method) => {
  if (!PAYMENT_METHODS.includes(method)) {
    throw new Error("Invalid payment method");
  }
};

const validateAttemptIdentity = (
  attempt,
  { requestHash, paymentMethod }
) => {
  if (!attempt) {
    return;
  }

  if (attempt.requestHash !== requestHash) {
    throw new Error(
      "Idempotency key was used with different checkout details"
    );
  }

  if (attempt.paymentMethod !== paymentMethod) {
    throw new Error(
      "Idempotency key was used with a different payment method"
    );
  }
};

// ======================================
// 1. Find Checkout Attempt
// ======================================

const findAttempt = async (
  userId,
  idempotencyKey
) => {
  return CheckoutAttempt.findOne({
    user: userId,
    idempotencyKey,
  });
};

// ======================================
// 2. Create Checkout Attempt
// ======================================

const createAttempt = async (data) => {
  validatePaymentMethod(
    data.paymentMethod || "Razorpay"
  );

  return CheckoutAttempt.create(data);
};

// ======================================
// 3. Update Checkout Attempt
// ======================================

const updateAttempt = async (
  attemptId,
  expectedStatus,
  updateData
) => {
  // Prevent generic updates from modifying
  // immutable checkout identity fields.
  const protectedFields = [
    "user",
    "idempotencyKey",
    "requestHash",
    "paymentMethod",
  ];

  if (
    !updateData ||
    typeof updateData !== "object" ||
    Array.isArray(updateData)
  ) {
    throw new Error("Invalid checkout update data");
  }

  for (const field of protectedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        updateData,
        field
      )
    ) {
      throw new Error(
        `Cannot update checkout identity field: ${field}`
      );
    }
  }

  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      status: expectedStatus,
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ======================================
// 4. Link Checkout Attempt to Order
// ======================================

// Existing positional arguments are preserved.
//
// For Razorpay-only checkout, amountInPaise
// is the full order amount.
//
// For split checkout, amountInPaise must be
// the Razorpay contribution only.
//
// For wallet-only checkout, amountInPaise
// is null because no Razorpay payment is made.

const linkAttemptToOrder = async (
  attemptId,
  userId,
  orderId,
  cartSnapshotHash,
  amountInPaise,
  session,
  options = {}
) => {
  if (!session) {
    throw new Error(
      "MongoDB transaction session required"
    );
  }

  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error("Invalid checkout identifiers");
  }

  if (
    typeof cartSnapshotHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(cartSnapshotHash)
  ) {
    throw new Error("Invalid cart snapshot hash");
  }

  const paymentMethod =
    options.paymentMethod || "Razorpay";

  validatePaymentMethod(paymentMethod);

  if (paymentMethod === "COD") {
    throw new Error(
      "COD checkout must use its existing order flow"
    );
  }

  const paymentBreakdown =
    options.paymentBreakdown || null;

  if (paymentMethod !== "Razorpay" &&
      !paymentBreakdown) {
    throw new Error(
      "Wallet checkout requires payment breakdown"
    );
  }

  if (paymentBreakdown) {
    const {
      totalPaise,
      walletPaise,
      razorpayPaise,
    } = paymentBreakdown;

    if (
      !Number.isSafeInteger(totalPaise) ||
      !Number.isSafeInteger(walletPaise) ||
      !Number.isSafeInteger(razorpayPaise) ||
      totalPaise < 100 ||
      walletPaise < 0 ||
      razorpayPaise < 0 ||
      walletPaise + razorpayPaise !== totalPaise
    ) {
      throw new Error(
        "Invalid checkout payment breakdown"
      );
    }

    if (
      paymentMethod === "Razorpay" &&
      (walletPaise !== 0 ||
       razorpayPaise !== totalPaise)
    ) {
      throw new Error(
        "Invalid Razorpay payment allocation"
      );
    }

    if (
      paymentMethod === "Wallet" &&
      (walletPaise !== totalPaise ||
       razorpayPaise !== 0)
    ) {
      throw new Error(
        "Invalid wallet payment allocation"
      );
    }

    if (
      paymentMethod === "Wallet+Razorpay" &&
      (walletPaise <= 0 ||
       razorpayPaise < 100)
    ) {
      throw new Error(
        "Invalid split payment allocation"
      );
    }

    if (
      isRazorpayMethod(paymentMethod) &&
      amountInPaise !== razorpayPaise
    ) {
      throw new Error(
        "Razorpay amount does not match allocation"
      );
    }

    if (
      paymentMethod === "Wallet" &&
      amountInPaise !== null
    ) {
      throw new Error(
        "Wallet-only checkout cannot have a Razorpay amount"
      );
    }
  } else if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    throw new Error(
      "Invalid Razorpay checkout amount"
    );
  }

  const updateData = {
    order: orderId,
    cartSnapshotHash,
    amountInPaise,
    currency: "INR",
  };

  if (paymentBreakdown) {
    updateData.paymentBreakdown = {
      totalPaise: paymentBreakdown.totalPaise,
      walletPaise: paymentBreakdown.walletPaise,
      razorpayPaise: paymentBreakdown.razorpayPaise,
    };
  }

  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,
      paymentMethod,
      status: "Processing",
      order: null,
      cartSnapshotHash: null,
      razorpayOrderId: null,
      recoveryRazorpayOrderId: null,
    },
    {
      $set: updateData,
    },
    {
      new: true,
      session,
      runValidators: true,
    }
  );
};

// ======================================
// 5. Find or Create Checkout Attempt
// ======================================

const findOrCreateAttempt = async ({
  userId,
  idempotencyKey,
  requestHash,
  paymentMethod = "Razorpay",
}) => {
  validatePaymentMethod(paymentMethod);

  if (
    typeof requestHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(requestHash)
  ) {
    throw new Error(
      "Invalid checkout request hash"
    );
  }

  let attempt;

  try {
    attempt =
      await CheckoutAttempt.findOneAndUpdate(
        {
          user: userId,
          idempotencyKey,
        },
        {
          $setOnInsert: {
            user: userId,
            idempotencyKey,
            requestHash,
            paymentMethod,
            status: "Processing",
          },
        },
        {
          upsert: true,
          new: true,
          runValidators: true,
        }
      );
  } catch (error) {
    // Concurrent request using the same key.
    if (error.code !== 11000) {
      throw error;
    }

    attempt = await CheckoutAttempt.findOne({
      user: userId,
      idempotencyKey,
    });

    if (!attempt) {
      throw error;
    }
  }

  validateAttemptIdentity(attempt, {
    requestHash,
    paymentMethod,
  });

  return attempt;
};

// ======================================
// 6. Claim Razorpay Payment Creation
// ======================================

const claimPaymentCreation = async ({
  attemptId,
  userId,
  orderId,
}) => {
  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,
      order: orderId,

      paymentMethod: {
        $in: RAZORPAY_METHODS,
      },

      status: "Processing",
      razorpayOrderId: null,
      recoveryRazorpayOrderId: null,
    },
    {
      $set: {
        status: "Creating Payment",
        errorMessage: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ======================================
// 7. Mark Razorpay Recovery Required
// ======================================

const markPaymentRecoveryRequired = async ({
  attemptId,
  userId,
  razorpayOrderId = null,
  errorMessage =
    "Payment creation requires reconciliation",
}) => {
  const updateData = {
    status: "Recovery Required",
    errorMessage,
  };

  if (razorpayOrderId) {
    updateData.recoveryRazorpayOrderId =
      razorpayOrderId;
  }

  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,

      paymentMethod: {
        $in: RAZORPAY_METHODS,
      },

      status: "Creating Payment",
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ======================================
// 8. Attach Razorpay Order ID
// ======================================

const attachPaymentOrderToAttempt = async ({
  attemptId,
  userId,
  orderId,
  razorpayOrderId,
}) => {
  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,
      order: orderId,

      paymentMethod: {
        $in: RAZORPAY_METHODS,
      },

      status: "Creating Payment",
      razorpayOrderId: null,
      recoveryRazorpayOrderId: null,
    },
    {
      $set: {
        razorpayOrderId,
        status: "Ready",
        errorMessage: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ======================================
// 9. Find Attempt by ID
// ======================================

const findAttemptById = async (attemptId) => {
  return CheckoutAttempt.findById(attemptId);
};

// ======================================
// EXPORTS
// ======================================

module.exports = {
  findAttempt,
  createAttempt,
  updateAttempt,
  linkAttemptToOrder,
  findOrCreateAttempt,
  claimPaymentCreation,
  markPaymentRecoveryRequired,
  attachPaymentOrderToAttempt,
  findAttemptById,
};
