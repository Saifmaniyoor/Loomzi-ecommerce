const CheckoutAttempt = require("../models/CheckoutAttempt");

const findAttempt = async (userId, idempotencyKey) => {
  return CheckoutAttempt.findOne({
    user: userId,
    idempotencyKey,
  });
};

const createAttempt = async (data) => {
  return CheckoutAttempt.create(data);
};

const updateAttempt = async (attemptId, expectedStatus, updateData) => {
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
    },
  );
};

const linkAttemptToOrder = async (
  attemptId,
  userId,
  orderId,
  cartSnapshotHash,
  amountInPaise,
  session,
) => {
  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,
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
    },
  );
};

const findOrCreateAttempt = async ({ userId, idempotencyKey, requestHash }) => {
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
          status: "Processing",
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );

    return attempt;
  } catch (error) {
    // Handle concurrent requests racing to create
    // the same unique checkout key.
    if (error.code === 11000) {
      return CheckoutAttempt.findOne({
        user: userId,
        idempotencyKey,
      });
    }

    throw error;
  }
};

const claimPaymentCreation = async ({ attemptId, userId, orderId }) => {
  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,
      order: orderId,
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
    },
  );
};

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
    updateData.recoveryRazorpayOrderId = razorpayOrderId;
  }

  return CheckoutAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      user: userId,
      status: "Creating Payment",
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    },
  );
};

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
    },
  );
};

const findAttemptById = async (attemptId) => {
  return CheckoutAttempt.findById(attemptId);
};

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
