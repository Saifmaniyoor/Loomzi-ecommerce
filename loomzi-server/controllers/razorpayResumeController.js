
const mongoose = require("mongoose");

const Order = require("../models/Order");
const CheckoutAttempt = require("../models/CheckoutAttempt");
const StockReservation = require("../models/StockReservation");

const {
  inspectPaymentRecovery,
} = require("../services/paymentRecoveryServices");

// TEST MODE ONLY. Read-only inspection cannot prevent another process
// from releasing stock or a late Razorpay payment from arriving.
// Do not enable in production without coordinated concurrency safeguards.
const resumeRazorpayCheckout = async (req, res) => {
  const userId = req.user?._id;
  const { orderId } = req.params;

  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_RAZORPAY_TEST_RESUME !== "true" ||
    !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
  ) {
    return res.status(403).json({
      message:
        "Payment continuation is disabled until live concurrency safeguards are installed.",
    });
  }

  if (!userId) {
    return res.status(401).json({
      message: "Please login to continue",
    });
  }

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({
      message: "Invalid Loomzi order ID",
    });
  }

  try {
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      paymentMethod: {
        $in: ["Razorpay", "Wallet+Razorpay"],
      },
    }).lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.paymentStatus === "Paid") {
      return res.json({
        orderId: String(orderId),
        paymentStatus: "Paid",
      });
    }

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

    const attempt = await CheckoutAttempt.findOne({
      order: orderId,
      user: userId,
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId,
      status: "Ready",
    }).lean();

    const reservation = await StockReservation.findOne({
      order: orderId,
      user: userId,
      status: "Active",
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!attempt) {
      const existingAttempt =
        await CheckoutAttempt.findOne({
          order: orderId,
          user: userId,
        })
          .select(
            "status paymentMethod razorpayOrderId"
          )
          .lean();

      console.warn(
        "Payment resume rejected: checkout attempt mismatch",
        {
          orderId: String(orderId),
          attemptExists: Boolean(existingAttempt),
          attemptStatus:
            existingAttempt?.status ?? null,
          paymentMethodMatches:
            existingAttempt?.paymentMethod ===
            order.paymentMethod,
          razorpayOrderIdMatches:
            existingAttempt?.razorpayOrderId ===
            order.razorpayOrderId,
        }
      );

      return res.status(409).json({
        code: "CHECKOUT_ATTEMPT_NOT_READY",
        message:
          "This checkout attempt is not ready for payment continuation. Check payment status; reconciliation may be required.",
      });
    }

    if (!reservation) {
      const existingReservation =
        await StockReservation.findOne({
          order: orderId,
        })
          .select("user status expiresAt")
          .lean();

      const expiryTime = existingReservation?.expiresAt
        ? new Date(
            existingReservation.expiresAt
          ).getTime()
        : NaN;

      console.warn(
        "Payment resume rejected: stock reservation unavailable",
        {
          orderId: String(orderId),
          reservationExists:
            Boolean(existingReservation),
          ownerMatches: existingReservation
            ? String(existingReservation.user) ===
              String(userId)
            : false,
          status:
            existingReservation?.status ?? null,
          expiresAt:
            existingReservation?.expiresAt ?? null,
          expired: Number.isFinite(expiryTime)
            ? expiryTime <= Date.now()
            : null,
        }
      );

      return res.status(409).json({
        code: "STOCK_RESERVATION_UNAVAILABLE",
        message:
          "The stock reservation is missing, released, or expired. Do not reopen payment for this order. Check payment status and reconcile it first.",
      });
    }

    const inspection = await inspectPaymentRecovery({
      attemptId: attempt._id,
      userId,
      orderId,
    });

    if (
      !inspection?.recoverable ||
      inspection.requiresReconciliation ||
      !Number.isSafeInteger(
        inspection.paymentCount
      ) ||
      inspection.paymentCount < 0 ||
      (
        inspection.paymentCount > 0 &&
        inspection.paymentStatus !== "failed"
      ) ||
      String(inspection.orderId) !==
        String(orderId) ||
      inspection.razorpayOrderId !==
        order.razorpayOrderId ||
      inspection.currency !== "INR" ||
      !Number.isSafeInteger(
        inspection.amountInPaise
      ) ||
      inspection.amountInPaise < 100 ||
      new Date(
        inspection.reservationExpiresAt
      ).getTime() <= Date.now()
    ) {
      const reason = !inspection
        ? "INSPECTION_MISSING"
        : inspection.requiresReconciliation
          ? "RECONCILIATION_REQUIRED"
          : !inspection.recoverable
            ? "NOT_RECOVERABLE"
            : (
                inspection.paymentCount > 0 &&
                inspection.paymentStatus !== "failed"
              )
              ? "PAYMENT_ACTIVITY_PRESENT"
              : new Date(
                  inspection.reservationExpiresAt
                ).getTime() <= Date.now()
                ? "RESERVATION_EXPIRED"
                : "INSPECTION_MISMATCH";

      console.warn(
        "Loomzi payment resume blocked",
        {
          orderId: String(orderId),
          reason,
          inspectionReason:
            inspection?.reason ?? null,
        }
      );

      return res.status(409).json({
        code: reason,
        ...(
          process.env.NODE_ENV !== "production" &&
          process.env.RAZORPAY_KEY_ID?.startsWith(
            "rzp_test_"
          )
            ? {
                diagnosticReason:
                  inspection?.reason ?? reason,
              }
            : {}
        ),
        message:
          "Payment needs verification or reservation expired. Do not retry.",
      });
    }

    // For split payments, only the Razorpay
    // contribution may be charged.
    const totalPaise = Math.round(
      order.totalAmount * 100
    );
    const breakdown = order.paymentBreakdown;

    const expectedRazorpayPaise =
      order.paymentMethod === "Wallet+Razorpay"
        ? breakdown?.razorpayPaise
        : totalPaise;

    if (
      !Number.isSafeInteger(totalPaise) ||
      !Number.isSafeInteger(
        expectedRazorpayPaise
      ) ||
      expectedRazorpayPaise < 100 ||
      inspection.amountInPaise !==
        expectedRazorpayPaise ||
      attempt.amountInPaise !==
        expectedRazorpayPaise ||
      (
        order.paymentMethod === "Wallet+Razorpay" &&
        (
          breakdown?.totalPaise !== totalPaise ||
          !Number.isSafeInteger(
            breakdown?.walletPaise
          ) ||
          breakdown.walletPaise <= 0 ||
          breakdown.walletPaise +
            breakdown.razorpayPaise !==
            totalPaise ||
          breakdown.walletStatus !== "Reserved"
        )
      )
    ) {
      return res.status(409).json({
        message:
          "Payment allocation mismatch. Reconciliation required.",
      });
    }

    // Test-only continuation of an EXISTING Razorpay order.
    // No new order, stock reservation, or wallet deduction.
    return res.json({
      orderId: String(orderId),
      paymentStatus: "Pending",
      keyId: process.env.RAZORPAY_KEY_ID,
      razorpayOrderId:
        inspection.razorpayOrderId,
      amountInPaise:
        inspection.amountInPaise,
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
