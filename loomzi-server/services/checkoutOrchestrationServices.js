
const checkoutAttemptServices = require(
  "./checkoutAttemptServices"
);

const Wallet = require("../models/Wallet");
const Order = require("../models/Order");

const {
  prepareOrderData,
} = require("../utils/checkoutPreparation");

const {
  createPendingOrderWithReservation,
} = require("./orderTransactionServices");

const {
  confirmWalletPaymentTransaction,
} = require("./paymentConfirmationTransactionServices");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

// =====================================================
// PAYMENT ALLOCATION HELPER
// =====================================================

function calculatePaymentAllocation({
  totalPaise,
  walletBalancePaise,
  useWallet,
}) {
  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid checkout total");
  }

  if (!useWallet) {
    return {
      paymentMethod: "Razorpay",
      paymentBreakdown: {
        totalPaise,
        walletPaise: 0,
        razorpayPaise: totalPaise,
      },
    };
  }

  if (
    !Number.isSafeInteger(walletBalancePaise) ||
    walletBalancePaise < 0
  ) {
    throw new Error("Invalid wallet balance");
  }

  let walletPaise = Math.min(
    walletBalancePaise,
    totalPaise
  );

  let razorpayPaise =
    totalPaise - walletPaise;

  // No wallet balance
  if (walletPaise === 0) {
    return {
      paymentMethod: "Razorpay",
      paymentBreakdown: {
        totalPaise,
        walletPaise: 0,
        razorpayPaise: totalPaise,
      },
    };
  }

  // Full wallet payment
  if (razorpayPaise === 0) {
    return {
      paymentMethod: "Wallet",
      paymentBreakdown: {
        totalPaise,
        walletPaise: totalPaise,
        razorpayPaise: 0,
      },
    };
  }

  // Minimum Razorpay contribution: ₹1
  if (razorpayPaise < 100) {
    walletPaise = totalPaise - 100;
    razorpayPaise = 100;
  }

  return {
    paymentMethod: "Wallet+Razorpay",
    paymentBreakdown: {
      totalPaise,
      walletPaise,
      razorpayPaise,
    },
  };
}

// =====================================================
// EXISTING CHECKOUT RECOVERY
// =====================================================

const recoverExistingCheckout = async ({
  attempt,
  userId,
}) => {
  if (!attempt.order) {
    return null;
  }

  const order = await Order.findOne({
    _id: attempt.order,
    user: userId,
  });

  if (!order) {
    throw new Error(
      "Checkout attempt references a missing order"
    );
  }

  if (
    order.paymentMethod !==
    attempt.paymentMethod
  ) {
    throw new Error(
      "Checkout payment method mismatch"
    );
  }

  // -------------------------------------------------
  // WALLET-ONLY CHECKOUT
  // -------------------------------------------------

  if (order.paymentMethod === "Wallet") {
    // Already paid and confirmed
    if (
      order.paymentStatus === "Paid" &&
      order.orderStatus === "Confirmed" &&
      order.paymentBreakdown?.walletStatus ===
        "Settled"
    ) {
      return {
        created: false,
        attemptId: attempt._id,
        orderId: order._id,
        status: "Completed",
        paymentMethod: "Wallet",
        paymentBreakdown:
          order.paymentBreakdown,
        message:
          "Wallet order already confirmed",
      };
    }

    // Wallet reserved but confirmation pending
    if (
      order.paymentStatus === "Pending" &&
      order.orderStatus === "Pending" &&
      order.paymentBreakdown?.walletStatus ===
        "Reserved"
    ) {
      const confirmation =
        await confirmWalletPaymentTransaction({
          userId,
          orderId: order._id,
        });

      const confirmedOrder =
        await Order.findOne({
          _id: order._id,
          user: userId,
        });

      if (
        !confirmedOrder ||
        confirmedOrder.paymentStatus !== "Paid" ||
        confirmedOrder.orderStatus !==
          "Confirmed" ||
        confirmedOrder.paymentBreakdown
          ?.walletStatus !== "Settled"
      ) {
        throw new Error(
          "Wallet checkout requires reconciliation"
        );
      }

      return {
        created: false,
        attemptId: attempt._id,
        orderId: order._id,
        status: "Completed",
        paymentMethod: "Wallet",
        paymentBreakdown:
          confirmedOrder.paymentBreakdown,
        confirmation,
        message:
          "Wallet checkout confirmed successfully",
      };
    }

    throw new Error(
      "Wallet checkout requires reconciliation"
    );
  }

  // -------------------------------------------------
  // RAZORPAY-ONLY OR WALLET + RAZORPAY
  // -------------------------------------------------

  if (
    order.paymentMethod !== "Razorpay" &&
    order.paymentMethod !== "Wallet+Razorpay"
  ) {
    throw new Error(
      "Unsupported checkout payment method"
    );
  }

  return {
    created: false,
    attemptId: attempt._id,
    orderId: order._id,
    status: attempt.status,
    paymentMethod: order.paymentMethod,
    paymentBreakdown:
      order.paymentBreakdown || null,
    message:
      "Checkout attempt already has an order",
  };
};

// =====================================================
// CREATE PENDING CHECKOUT ORDER
// =====================================================

const createPendingCheckoutOrder = async ({
  userId,
  idempotencyKey,
  requestBody,
}) => {
  // 1. Validate idempotency key
  const key = validateIdempotencyKey(
    idempotencyKey
  );

  // 2. Normalize checkout request
  const normalizedRequest =
    normalizeCheckoutRequest(
      requestBody || {}
    );

  const requestHash =
    createRequestHash(normalizedRequest);

  // 3. Find prepared checkout attempt
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

  // 4. Validate idempotency
  if (
    attempt.requestHash !== requestHash
  ) {
    throw new Error(
      "Idempotency key was used with different checkout details"
    );
  }

  // 5. Recover existing checkout
  if (attempt.order) {
    return recoverExistingCheckout({
      attempt,
      userId,
    });
  }

  // 6. Verify checkout status
  if (
    attempt.status !== "Processing"
  ) {
    throw new Error(
      "Checkout attempt is not available for order creation"
    );
  }

  // 7. Prepare trusted order data
  const orderData =
    await prepareOrderData({
      userId,
      addressId:
        normalizedRequest.addressId,
      couponCode:
        normalizedRequest.couponCode,
    });

  // 8. Check wallet selection
  const useWallet =
    normalizedRequest.useWallet === true;

  let walletBalancePaise = 0;

  if (useWallet) {
    const wallet =
      await Wallet.findOne({
        user: userId,
      }).select("balancePaise");

    walletBalancePaise =
      wallet?.balancePaise ?? 0;
  }

  // 9. Calculate payment allocation
  const allocation =
    calculatePaymentAllocation({
      totalPaise:
        orderData.amountInPaise,
      walletBalancePaise,
      useWallet,
    });

  // 10. Validate prepared payment method
  if (
    attempt.paymentMethod !==
    allocation.paymentMethod
  ) {
    throw new Error(
      "Checkout payment method changed. Prepare a new checkout attempt."
    );
  }

  // 11. Validate coupon payment restriction
  const appliedCouponCode =
    orderData.coupon?.code ||
    normalizedRequest.couponCode ||
    null;

  if (
    typeof appliedCouponCode ===
      "string" &&
    appliedCouponCode
      .trim()
      .toUpperCase() === "LOOMZI10" &&
    allocation.paymentMethod === "Wallet"
  ) {
    throw new Error(
      "LOOMZI10 requires Razorpay payment and cannot be used for wallet-only checkout"
    );
  }

  try {
    // 12. Create order and reserve stock
    // and wallet funds atomically.
    const order =
      await createPendingOrderWithReservation({
        attemptId: attempt._id,
        userId,
        ...orderData,
        paymentMethod:
          allocation.paymentMethod,
        paymentBreakdown:
          allocation.paymentBreakdown,
      });

    // -------------------------------------------------
    // WALLET-ONLY CHECKOUT
    // -------------------------------------------------

    if (
      allocation.paymentMethod === "Wallet"
    ) {
      const confirmation =
        await confirmWalletPaymentTransaction({
          userId,
          orderId: order._id,
        });

      const confirmedOrder =
        await Order.findOne({
          _id: order._id,
          user: userId,
        });

      if (
        !confirmedOrder ||
        confirmedOrder.paymentStatus !==
          "Paid" ||
        confirmedOrder.orderStatus !==
          "Confirmed" ||
        confirmedOrder.paymentBreakdown
          ?.walletStatus !== "Settled"
      ) {
        throw new Error(
          "Wallet checkout requires reconciliation"
        );
      }

      return {
        created: true,
        attemptId: attempt._id,
        orderId: order._id,
        status: "Completed",
        paymentMethod: "Wallet",
        paymentBreakdown:
          confirmedOrder.paymentBreakdown,
        confirmation,
        message:
          "Wallet payment completed successfully",
      };
    }

    // -------------------------------------------------
    // RAZORPAY-ONLY / SPLIT CHECKOUT
    // -------------------------------------------------

    return {
      created: true,
      attemptId: attempt._id,
      orderId: order._id,
      status: "Processing",
      paymentMethod:
        allocation.paymentMethod,
      paymentBreakdown:
        order.paymentBreakdown,
      message:
        "Pending order created successfully",
    };
  } catch (error) {
    // 13. Check for a previously linked order
    // to prevent duplicate reservations.
    const latestAttempt =
      await checkoutAttemptServices.findAttempt(
        userId,
        key
      );

    if (
      latestAttempt &&
      latestAttempt.requestHash ===
        requestHash &&
      latestAttempt.order
    ) {
      return recoverExistingCheckout({
        attempt: latestAttempt,
        userId,
      });
    }

    throw error;
  }
};

module.exports = {
  createPendingCheckoutOrder,
};
