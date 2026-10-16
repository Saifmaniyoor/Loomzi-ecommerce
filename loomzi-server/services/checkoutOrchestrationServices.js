
const checkoutAttemptServices = require(
  "./checkoutAttemptServices"
);

const {
  prepareOrderData,
} = require("../utils/checkoutPreparation");

const {
  createPendingOrderWithReservation,
} = require("./orderTransactionServices");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

// Internal operation only.
// Do not expose this as a public API yet.
const createPendingCheckoutOrder = async ({
  userId,
  idempotencyKey,
  requestBody,
}) => {
  // 1. Validate request
  const key = validateIdempotencyKey(
    idempotencyKey
  );

  const normalizedRequest =
    normalizeCheckoutRequest(requestBody || {});

  const requestHash =
    createRequestHash(normalizedRequest);

  // 2. Find existing checkout attempt
  const attempt =
    await checkoutAttemptServices.findAttempt(
      userId,
      key
    );

  if (!attempt) {
    throw new Error(
      "Checkout attempt not found. Prepare checkout first."
    );
  }

  // 3. Prevent key reuse with different details
  if (attempt.requestHash !== requestHash) {
    throw new Error(
      "Idempotency key was used with different checkout details"
    );
  }

  // 4. Return existing order if already linked
  if (attempt.order) {
    return {
      created: false,
      orderId: attempt.order,
      status: attempt.status,
      message: "Checkout attempt already has an order",
    };
  }

  if (attempt.status !== "Processing") {
    throw new Error(
      "Checkout attempt is not available for order creation"
    );
  }

  // 5. Prepare checkout using backend data
  const orderData = await prepareOrderData({
    userId,
    addressId: normalizedRequest.addressId,
    couponCode: normalizedRequest.couponCode,
  });

  try {
    // 6. Create pending order and reserve stock
    const order =
      await createPendingOrderWithReservation({
        attemptId: attempt._id,
        userId,
        ...orderData,
      });

    return {
      created: true,
      orderId: order._id,
      status: "Processing",
      message: "Pending order created successfully",
    };

  } catch (error) {
    // 7. Check whether another request created the order
    const latestAttempt =
      await checkoutAttemptServices.findAttempt(
        userId,
        key
      );

    if (
      latestAttempt &&
      latestAttempt.requestHash === requestHash &&
      latestAttempt.order
    ) {
      return {
        created: false,
        orderId: latestAttempt.order,
        status: latestAttempt.status,
        message: "Existing checkout order recovered",
      };
    }

    // 8. No existing order found.
    // Throw original error.
    throw error;
  }
};

module.exports = {
  createPendingCheckoutOrder,
};
