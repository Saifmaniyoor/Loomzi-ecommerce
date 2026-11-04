
const {
  inspectWebhookEvent,
} = require("./webhookRecoveryInspectionServices");

const {
  verifyWebhookCapturedPayment,
} = require("./webhookPaymentReconciliationServices");

// ==========================================
// VERIFY RECOVERED WEBHOOK PAYMENT
// ==========================================

// READ-ONLY SERVICE.
//
// Supports:
// 1. Razorpay-only payments
// 2. Wallet + Razorpay split payments
//
// Wallet-only orders do not use Razorpay
// payment.captured webhooks.
//
// This function does NOT:
// - Confirm orders
// - Settle wallet reservations
// - Update stock
// - Update checkout attempts
// - Change webhook status
//
// All payment amounts are verified
// against Razorpay and trusted order data
// by verifyWebhookCapturedPayment().

const verifyRecoveredWebhookPayment = async (
  eventId
) => {
  // 1. Validate event ID
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason: "Invalid webhook event ID",
    };
  }

  // 2. Inspect stored webhook
  const inspection =
    await inspectWebhookEvent(eventId);

  if (!inspection || !inspection.found) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason: "Webhook event not found",
    };
  }

  // 3. Check whether the payment
  // details can be inspected.
  if (!inspection.canInspectPayment) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        inspection.reason ||
        "Webhook payload cannot be inspected",
    };
  }

  // 4. Accept only captured-payment events
  if (
    inspection.eventType !==
    "payment.captured"
  ) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        "This service only verifies payment.captured events",
    };
  }

  // 5. Extract stored payment details
  const {
    razorpayOrderId,
    razorpayPaymentId,
    amountInPaise,
  } = inspection.paymentDetails || {};

  // 6. Validate Razorpay identifiers
  if (
    typeof razorpayOrderId !== "string" ||
    !/^order_[A-Za-z0-9]+$/.test(
      razorpayOrderId
    ) ||
    typeof razorpayPaymentId !== "string" ||
    !/^pay_[A-Za-z0-9]+$/.test(
      razorpayPaymentId
    )
  ) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        "Stored webhook payment identifiers are invalid",
    };
  }

  // 7. Validate stored payment amount
  //
  // For split payments, this represents
  // only the Razorpay contribution.
  if (
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100
  ) {
    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        "Stored webhook payment amount is invalid",
    };
  }

  // 8. Verify payment directly with Razorpay
  // and match it to the saved Loomzi order.
  try {
    const verification =
      await verifyWebhookCapturedPayment({
        razorpayOrderId,
        razorpayPaymentId,
        amountInPaise,
      });

    if (
      !verification ||
      verification.verified !== true
    ) {
      return {
        verified: false,
        requiresReconciliation: true,
        reason:
          verification?.reason ||
          "Payment verification unsuccessful",
      };
    }

    // 9. Verify returned payment identity
    if (
      verification.razorpayOrderId !==
        razorpayOrderId ||
      verification.razorpayPaymentId !==
        razorpayPaymentId ||
      verification.amountInPaise !==
        amountInPaise ||
      !verification.orderId ||
      !verification.userId
    ) {
      return {
        verified: false,
        requiresReconciliation: true,
        reason:
          "Recovered payment verification details mismatch",
      };
    }

    // 10. Return verified information
    //
    // No MongoDB changes happen here.
    return {
      verified: true,
      requiresReconciliation: false,
      eventId: inspection.eventId,
      eventType: inspection.eventType,
      orderId: verification.orderId,
      userId: verification.userId,
      razorpayOrderId:
        verification.razorpayOrderId,
      razorpayPaymentId:
        verification.razorpayPaymentId,
      amountInPaise:
        verification.amountInPaise,
      currency: verification.currency,
      paymentStatus:
        verification.paymentStatus,
      alreadyPaid:
        verification.alreadyPaid === true,
    };
  } catch (error) {
    // Provider or network failures are
    // uncertain payment states.
    //
    // Do not treat them as failed payments.
    console.error(
      "Recovered webhook verification error:",
      error.message
    );

    return {
      verified: false,
      requiresReconciliation: true,
      reason:
        "Unable to verify payment with Razorpay",
    };
  }
};

module.exports = {
  verifyRecoveredWebhookPayment,
};
