
const mongoose = require("mongoose");

const checkoutAttemptServices = require(
  "./checkoutAttemptServices"
);

const orderServices = require("./orderServices");

const paymentServices = require("./paymentServices");

const stockReservationServices = require(
  "./stockReservationServices"
);

const {
  claimPaymentCreationTransaction,
} = require("./paymentClaimTransactionServices");

const {
  linkRazorpayOrderTransaction,
} = require("./paymentLinkTransactionServices");

// Internal service only.
//
// Do not expose as a public API until webhook,
// reconciliation, and payment recovery safeguards
// have been implemented and tested.
const createPaymentOrder = async ({
  attemptId,
  userId,
  orderId,
}) => {
  // 1. Validate identifiers
  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(orderId)
  ) {
    throw new Error(
      "Invalid payment creation identifiers"
    );
  }

  // 2. Retrieve checkout attempt
  const attempt =
    await checkoutAttemptServices.findAttemptById(
      attemptId
    );

  if (
    !attempt ||
    String(attempt.user) !== String(userId) ||
    String(attempt.order) !== String(orderId)
  ) {
    throw new Error("Checkout attempt not found");
  }

  // 3. Prevent duplicate payment creation
  if (attempt.status === "Ready") {
    throw new Error(
      "An existing Razorpay order requires payment-state verification"
    );
  }

  if (
    attempt.status === "Creating Payment" ||
    attempt.status === "Recovery Required"
  ) {
    throw new Error(
      "Payment creation is already in progress or requires reconciliation"
    );
  }

  if (attempt.status !== "Processing") {
    throw new Error(
      "Checkout is not ready for payment creation"
    );
  }

  // 4. Reject attempts with existing Razorpay IDs
  if (
    attempt.razorpayOrderId ||
    attempt.recoveryRazorpayOrderId
  ) {
    throw new Error(
      "Existing Razorpay order requires reconciliation"
    );
  }

  // 5. Verify Loomzi order
  const order =
    await orderServices.findOrderByIdAndUser({
      orderId,
      userId,
    });

  if (
    !order ||
    order.paymentStatus !== "Pending" ||
    order.orderStatus !== "Pending" ||
    order.razorpayOrderId ||
    order.razorpayPaymentId
  ) {
    throw new Error(
      "Loomzi order is not available for payment"
    );
  }

  // 6. Verify amount and currency
  const expectedAmountInPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(expectedAmountInPaise) ||
    expectedAmountInPaise < 100 ||
    attempt.amountInPaise !== expectedAmountInPaise ||
    attempt.currency !== "INR"
  ) {
    throw new Error("Payment amount mismatch");
  }

  // 7. Find stock reservation
  const reservation =
    await stockReservationServices
      .findReservationByOrderId(orderId);

  if (
    !reservation ||
    String(reservation.user) !== String(userId) ||
    String(reservation.order) !== String(orderId) ||
    reservation.status !== "Active"
  ) {
    throw new Error(
      "Active stock reservation not found"
    );
  }

  // 8. Verify reservation expiry
  const expiresAt = new Date(
    reservation.expiresAt
  );

  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt.getTime() <= Date.now()
  ) {
    throw new Error(
      "Stock reservation has expired. Please restart checkout."
    );
  }

  // 9. Atomically claim payment creation
  //
  // This transaction must verify that:
  // - Attempt is still Processing
  // - Order is still Pending
  // - Reservation is Active and unexpired
  // - No Razorpay order has been linked
  const claimed =
    await claimPaymentCreationTransaction({
      attemptId,
      userId,
      orderId,
    });

  if (
    !claimed ||
    claimed.status !== "Creating Payment" ||
    claimed.amountInPaise !== expectedAmountInPaise ||
    claimed.currency !== "INR"
  ) {
    throw new Error(
      "Unable to claim payment creation safely"
    );
  }

  // 10. Create Razorpay order
  //
  // External API call happens outside the
  // MongoDB transaction.
  //
  // Never blindly retry orders.create().
  let razorpayOrder;

  try {
    razorpayOrder =
      await paymentServices.createRazorpayOrder({
        amount: claimed.amountInPaise,
        receipt: String(orderId),
      });
  } catch (error) {
    console.error(
      "Razorpay order creation uncertain:",
      error.message
    );

    try {
      await checkoutAttemptServices
        .markPaymentRecoveryRequired({
          attemptId,
          userId,
          errorMessage:
            "Razorpay order creation outcome is uncertain",
        });
    } catch (recoveryError) {
      console.error(
        "Unable to persist recovery state:",
        recoveryError
      );
    }

    throw new Error(
      "Razorpay order creation requires reconciliation. Do not retry payment creation."
    );
  }

  // 11. Verify Razorpay order response
  if (
    !razorpayOrder ||
    typeof razorpayOrder.id !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(
      razorpayOrder.id
    ) ||
    razorpayOrder.amount !== claimed.amountInPaise ||
    razorpayOrder.currency !== "INR" ||
    razorpayOrder.receipt !== String(orderId)
  ) {
    try {
      await checkoutAttemptServices
        .markPaymentRecoveryRequired({
          attemptId,
          userId,
          razorpayOrderId:
            razorpayOrder?.id || null,
          errorMessage:
            "Unexpected Razorpay order response",
        });
    } catch (recoveryError) {
      console.error(
        "Unable to persist recovery details:",
        recoveryError
      );
    }

    throw new Error(
      "Razorpay order details require reconciliation"
    );
  }

  // 12. Link Razorpay order to MongoDB
  try {
    const linked =
      await linkRazorpayOrderTransaction({
        attemptId,
        userId,
        orderId,
        razorpayOrderId: razorpayOrder.id,
        amountInPaise: claimed.amountInPaise,
      });

    return {
      ...linked,
      reused: false,
    };
  } catch (error) {
    console.error(
      "Razorpay order linking uncertain:",
      error.message
    );

    // A transaction commit can succeed even if
    // its acknowledgement is lost.
    //
    // Check the persisted records before
    // changing the attempt to Recovery Required.
    let linkConfirmed = false;

    try {
      const [currentAttempt, currentOrder] =
        await Promise.all([
          checkoutAttemptServices
            .findAttemptById(attemptId),
          orderServices.findOrderByIdAndUser({
            orderId,
            userId,
          }),
        ]);

      linkConfirmed =
        currentAttempt?.status === "Ready" &&
        currentAttempt?.razorpayOrderId ===
          razorpayOrder.id &&
        currentOrder?.razorpayOrderId ===
          razorpayOrder.id;
    } catch (lookupError) {
      console.error(
        "Unable to inspect payment linking state:",
        lookupError
      );
    }

    if (!linkConfirmed) {
      try {
        await checkoutAttemptServices
          .markPaymentRecoveryRequired({
            attemptId,
            userId,
            razorpayOrderId:
              razorpayOrder.id,
            errorMessage:
              "Razorpay order linking requires reconciliation",
          });
      } catch (recoveryError) {
        console.error(
          "Unable to persist recovery state:",
          recoveryError
        );
      }
    }

    // Even when linking appears committed,
    // do not return a payment-ready response
    // from this uncertain execution path.
    throw new Error(
      "Payment creation outcome requires verification before continuing."
    );
  }
};

module.exports = {
  createPaymentOrder,
};
