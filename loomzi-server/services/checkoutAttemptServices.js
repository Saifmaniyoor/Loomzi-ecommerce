
const CheckoutAttempt = require("../models/CheckoutAttempt");

// ======================================
// 1. Find Checkout Attempt
// ======================================

const findAttempt = async (userId, idempotencyKey) => {
  return CheckoutAttempt.findOne({
    user: userId,
    idempotencyKey,
  });
};

// ======================================
// 2. Create Checkout Attempt
// ======================================

const createAttempt = async (data) => {
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
// 4. Link Razorpay Attempt to Order
// ======================================

const linkAttemptToOrder = async (
  attemptId,
  userId,
  orderId,
  cartSnapshotHash,
  amountInPaise,
  session
) => {
  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,

      // Only Razorpay attempts
      paymentMethod: "Razorpay",

      status: "Processing",
      order: null,
      cartSnapshotHash: null,
    },
    {
      $set: {
        order: orderId,
        cartSnapshotHash,
        amountInPaise,
        currency: "INR",
      },
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
// Supports Razorpay and COD
// ======================================

const findOrCreateAttempt = async ({
  userId,
  idempotencyKey,
  requestHash,
  paymentMethod = "Razorpay",
}) => {
  if (!["Razorpay", "COD"].includes(paymentMethod)) {
    throw new Error("Invalid payment method");
  }

  try {
    const attempt = await CheckoutAttempt.findOneAndUpdate(
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

    return attempt;
  } catch (error) {
    // Handle concurrent requests using the same key
    if (error.code === 11000) {
      return CheckoutAttempt.findOne({
        user: userId,
        idempotencyKey,
      });
    }

    throw error;
  }
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

      // Prevent COD from entering Razorpay flow
      paymentMethod: "Razorpay",

      status: "Processing",
      razorpayOrderId: null,
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
  errorMessage = "Payment creation requires reconciliation",
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

      // Only Razorpay attempts
      paymentMethod: "Razorpay",

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

      // Only Razorpay attempts
      paymentMethod: "Razorpay",

      status: "Creating Payment",
      razorpayOrderId: null,
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
// Exports
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
