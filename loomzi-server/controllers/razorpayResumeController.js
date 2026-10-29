
const mongoose = require("mongoose");

const Order = require("../models/Order");
const CheckoutAttempt = require("../models/CheckoutAttempt");
const StockReservation = require("../models/StockReservation");

const {
  inspectPaymentRecovery,
} = require("../services/paymentRecoveryServices");

// IMPORTANT: TEST MODE ONLY.
// This read-only check cannot prevent a separate expiry/cancellation
// worker from releasing stock immediately afterward.
// Do not enable in live mode.

const resumeRazorpayCheckout = async (req, res) => {
  // 1. Get values before using them
  const userId = req.user?._id;
  const { orderId } = req.params;

  // 2. Debug logs
  console.log(
    "Test resume enabled:",
    process.env.ENABLE_RAZORPAY_TEST_RESUME
  );

  console.log(
    "Razorpay test key:",
    process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
  );

  console.log("Resume orderId:", orderId);
  console.log(
    "Valid ObjectId:",
    mongoose.isValidObjectId(orderId)
  );
  console.log(
    "Authenticated user present:",
    Boolean(userId)
  );

  // 3. Test-mode safety check
  if (
    process.env.ENABLE_RAZORPAY_TEST_RESUME !== "true" ||
    !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
  ) {
    return res.status(403).json({
      message:
        "Payment continuation is disabled until live concurrency safeguards are installed.",
    });
  }

  // 4. Validate order ID and authenticated user
  if (!userId || !mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({
      message: "Invalid order",
    });
  }

  try {
    // 5. Find the existing order belonging to this user
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      paymentMethod: "Razorpay",
    }).lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // 6. If already paid, do not open Razorpay again
    if (order.paymentStatus === "Paid") {
      return res.json({
        orderId: String(orderId),
        paymentStatus: "Paid",
      });
    }

    // 7. Check whether the existing order is eligible
    if (
      order.paymentStatus !== "Pending" ||
      order.orderStatus !== "Pending" ||
      order.razorpayPaymentId ||
      !/^order_[a-zA-Z0-9]+$/.test(
        order.razorpayOrderId || ""
      )
    ) {
      return res.status(409).json({
        message:
          "This order cannot be resumed. Check its payment status.",
      });
    }

    // 8. Find the existing checkout attempt
    const attempt = await CheckoutAttempt.findOne({
      order: orderId,
      user: userId,
      paymentMethod: "Razorpay",
      razorpayOrderId: order.razorpayOrderId,
      status: "Ready",
    }).lean();

    // 9. Find an active, unexpired stock reservation
    const reservation = await StockReservation.findOne({
      order: orderId,
      user: userId,
      status: "Active",
      expiresAt: {
        $gt: new Date(),
      },
    }).lean();

    // Diagnose mismatches without altering stock or payment state.
    // A failed lookup does NOT mean it is safe to retry payment.
    if (!attempt) {
      const existingAttempt = await CheckoutAttempt.findOne({
        order: orderId,
        user: userId,
      }).select("status paymentMethod razorpayOrderId").lean();

      console.warn("Payment resume rejected: checkout attempt mismatch", {
        orderId: String(orderId),
        attemptExists: Boolean(existingAttempt),
        attemptStatus: existingAttempt?.status ?? null,
        paymentMethodMatches:
          existingAttempt?.paymentMethod === "Razorpay",
        razorpayOrderIdMatches:
          existingAttempt?.razorpayOrderId === order.razorpayOrderId,
      });

      return res.status(409).json({
        code: "CHECKOUT_ATTEMPT_NOT_READY",
        message:
          "This checkout attempt is not ready for payment continuation. Check payment status; reconciliation may be required.",
      });
    }

    if (!reservation) {
      const existingReservation = await StockReservation.findOne({
        order: orderId,
      }).select("user status expiresAt").lean();

      const ownerMatches = existingReservation
        ? String(existingReservation.user) === String(userId)
        : false;
      const expiryTime = existingReservation?.expiresAt
        ? new Date(existingReservation.expiresAt).getTime()
        : NaN;

      console.warn("Payment resume rejected: stock reservation unavailable", {
        orderId: String(orderId),
        reservationExists: Boolean(existingReservation),
        ownerMatches,
        status: existingReservation?.status ?? null,
        expiresAt: existingReservation?.expiresAt ?? null,
        expired: Number.isFinite(expiryTime)
          ? expiryTime <= Date.now()
          : null,
      });

      return res.status(409).json({
        code: "STOCK_RESERVATION_UNAVAILABLE",
        message:
          "The stock reservation is missing, released, or expired. Do not reopen payment for this order. Check payment status and reconcile it first.",
      });
    }

    // 10. Inspect existing Razorpay payment activity
    const inspection = await inspectPaymentRecovery({
      attemptId: attempt._id,
      userId,
      orderId,
    });

    // 11. Validate the recovery inspection
    if (
      !inspection?.recoverable ||
      inspection.requiresReconciliation ||
      inspection.paymentCount !== 0 ||
      String(inspection.orderId) !== String(orderId) ||
      inspection.razorpayOrderId !==
        order.razorpayOrderId ||
      inspection.currency !== "INR" ||
      !Number.isSafeInteger(inspection.amountInPaise) ||
      inspection.amountInPaise < 100 ||
      new Date(
        inspection.reservationExpiresAt
      ).getTime() <= Date.now()
    ) {
      return res.status(409).json({
        message:
          "Payment needs verification or reservation expired. Do not retry.",
      });
    }

    // 12. Return the EXISTING Razorpay order details
    // No new Loomzi order or stock reservation is created.
    return res.json({
      orderId: String(orderId),
      paymentStatus: "Pending",
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId: inspection.razorpayOrderId,
      amountInPaise: inspection.amountInPaise,
      currency: "INR",
      reservationExpiresAt:
        inspection.reservationExpiresAt,
    });
  } catch (error) {
    console.error(
      "Test payment continuation failed:",
      error
    );

    return res.status(409).json({
      message:
        "Could not verify payment safely. Check payment status before continuing.",
    });
  }
};

module.exports = {
  resumeRazorpayCheckout,
};
