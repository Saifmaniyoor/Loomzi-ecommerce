
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

// ==========================================
// PAYMENT METHODS USING RAZORPAY
// ==========================================

const RAZORPAY_METHODS = [
  "Razorpay",
  "Wallet+Razorpay",
];

// ==========================================
// VALIDATE PAYMENT ALLOCATION
// ==========================================

const getExpectedRazorpayAmount = (order) => {
  const totalPaise = Math.round(
    order.totalAmount * 100
  );

  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid order total");
  }

  // Existing Razorpay orders may not have
  // a payment breakdown.
  if (order.paymentMethod === "Razorpay") {
    if (order.paymentBreakdown) {
      const breakdown = order.paymentBreakdown;

      if (
        breakdown.totalPaise !== totalPaise ||
        breakdown.walletPaise !== 0 ||
        breakdown.razorpayPaise !== totalPaise
      ) {
        throw new Error(
          "Razorpay payment breakdown mismatch"
        );
      }
    }

    return totalPaise;
  }

  // Split payment: only the remaining
  // amount should be sent to Razorpay.
  if (order.paymentMethod === "Wallet+Razorpay") {
    const breakdown = order.paymentBreakdown;

    if (!breakdown) {
      throw new Error(
        "Split payment breakdown is missing"
      );
    }

    const {
      totalPaise: breakdownTotal,
      walletPaise,
      razorpayPaise,
      walletStatus,
    } = breakdown;

    if (
      !Number.isSafeInteger(breakdownTotal) ||
      !Number.isSafeInteger(walletPaise) ||
      !Number.isSafeInteger(razorpayPaise) ||
      breakdownTotal !== totalPaise ||
      walletPaise <= 0 ||
      razorpayPaise < 100 ||
      walletPaise + razorpayPaise !== totalPaise ||
      walletStatus !== "Reserved"
    ) {
      throw new Error(
        "Invalid split payment allocation"
      );
    }

    return razorpayPaise;
  }

  throw new Error(
    "This payment method does not require Razorpay"
  );
};

// ==========================================
// VALIDATE CHECKOUT ATTEMPT
// ==========================================

const validateAttemptPayment = ({
  attempt,
  order,
  expectedAmountInPaise,
}) => {
  if (attempt.paymentMethod !== order.paymentMethod) {
    throw new Error(
      "Checkout payment method mismatch"
    );
  }

  if (
    attempt.amountInPaise !== expectedAmountInPaise ||
    attempt.currency !== "INR"
  ) {
    throw new Error(
      "Checkout Razorpay amount mismatch"
    );
  }

  // Older Razorpay-only attempts may not
  // contain a payment breakdown.
  if (
    order.paymentMethod === "Razorpay" &&
    !attempt.paymentBreakdown
  ) {
    return;
  }

  const attemptBreakdown = attempt.paymentBreakdown;
  const orderBreakdown = order.paymentBreakdown;

  if (!attemptBreakdown || !orderBreakdown) {
    throw new Error(
      "Checkout payment breakdown is missing"
    );
  }

  if (
    attemptBreakdown.totalPaise !==
      orderBreakdown.totalPaise ||
    attemptBreakdown.walletPaise !==
      orderBreakdown.walletPaise ||
    attemptBreakdown.razorpayPaise !==
      orderBreakdown.razorpayPaise
  ) {
    throw new Error(
      "Checkout payment breakdown mismatch"
    );
  }
};

// ==========================================
// CREATE RAZORPAY PAYMENT ORDER
// ==========================================

// Internal service only.
//
// Do not expose publicly until payment
// verification, webhook handling,
// reconciliation, and recovery have been
// implemented and tested.

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

  // 3. Reject wallet-only and COD attempts
  if (
    !RAZORPAY_METHODS.includes(
      attempt.paymentMethod
    )
  ) {
    throw new Error(
      "This checkout does not require Razorpay"
    );
  }

  // 4. Prevent duplicate payment creation
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

  // 5. Reject existing Razorpay IDs
  if (
    attempt.razorpayOrderId ||
    attempt.recoveryRazorpayOrderId
  ) {
    throw new Error(
      "Existing Razorpay order requires reconciliation"
    );
  }

  // 6. Verify Loomzi order
  const order =
    await orderServices.findOrderByIdAndUser({
      orderId,
      userId,
    });

  if (
    !order ||
    order.paymentMethod !==
      attempt.paymentMethod ||
    !RAZORPAY_METHODS.includes(
      order.paymentMethod
    ) ||
    order.paymentStatus !== "Pending" ||
    order.orderStatus !== "Pending" ||
    order.razorpayOrderId ||
    order.razorpayPaymentId
  ) {
    throw new Error(
      "Loomzi order is not available for Razorpay payment"
    );
  }

  // 7. Calculate the correct Razorpay amount
  const expectedAmountInPaise =
    getExpectedRazorpayAmount(order);

  // 8. Validate checkout attempt allocation
  validateAttemptPayment({
    attempt,
    order,
    expectedAmountInPaise,
  });

  // 9. Find stock reservation
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

  // 10. Verify reservation expiry
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

  // 11. Atomically claim payment creation
  //
  // The claim transaction rechecks:
  // - Pending order
  // - Processing attempt
  // - Correct Razorpay amount
  // - Active stock reservation
  const claimed =
    await claimPaymentCreationTransaction({
      attemptId,
      userId,
      orderId,
    });

  if (
    !claimed ||
    claimed.status !== "Creating Payment" ||
    claimed.amountInPaise !==
      expectedAmountInPaise ||
    claimed.currency !== "INR" ||
    claimed.paymentMethod !==
      order.paymentMethod
  ) {
    throw new Error(
      "Unable to claim payment creation safely"
    );
  }

  // 12. Create Razorpay order
  //
  // This external API call happens outside
  // the MongoDB transaction.
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

  // 13. Verify Razorpay response
  if (
    !razorpayOrder ||
    typeof razorpayOrder.id !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(
      razorpayOrder.id
    ) ||
    razorpayOrder.amount !==
      claimed.amountInPaise ||
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

  // 14. Link Razorpay order to MongoDB
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

    // A MongoDB transaction may commit
    // even when its acknowledgement is lost.
    //
    // Inspect both persisted records
    // before marking recovery required.
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

    // Do not return payment-ready information
    // from an uncertain execution path.
    throw new Error(
      "Payment creation outcome requires verification before continuing."
    );
  }
};

module.exports = {
  createPaymentOrder,
};
