
const {
  findWebhookEventById,
  markWebhookEventForReconciliation,
} = require("./webhookEventServices");

const {
  evaluateWebhookRecovery,
} = require("./webhookRecoveryDecisionServices");

const {
  confirmCapturedPaymentTransaction,
} = require("./paymentConfirmationTransactionServices");

// ==========================================
// EXECUTE WEBHOOK RECOVERY
// ==========================================

// Internal service only.
//
// Supports:
// 1. Razorpay-only payments
// 2. Wallet + Razorpay split payments
//
// Wallet-only orders do not use Razorpay
// payment.captured webhook recovery.
//
// IMPORTANT:
// Do not expose this function publicly.
//
// The caller must provide the current
// webhook processing token.
//
// Never release wallet reservations
// or mark payments as Failed when the
// Razorpay payment outcome is uncertain.

const executeWebhookRecovery = async ({
  eventId,
  processingToken,
}) => {
  // 1. Validate inputs
  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    typeof processingToken !== "string" ||
    !processingToken.trim()
  ) {
    throw new Error(
      "Valid event ID and processing token required"
    );
  }

  const normalizedEventId = eventId.trim();
  const normalizedToken = processingToken.trim();

  // 2. Verify initial webhook ownership
  const event = await findWebhookEventById(
    normalizedEventId
  );

  if (
    !event ||
    event.status !== "Processing" ||
    event.processingToken !== normalizedToken
  ) {
    return {
      completed: false,
      requiresReconciliation: true,
      reason:
        "Webhook event is not owned by this worker",
    };
  }

  // 3. Check event type
  if (event.eventType !== "payment.captured") {
    const updated =
      await markWebhookEventForReconciliation({
        eventId: normalizedEventId,
        processingToken: normalizedToken,
        reason: "Unsupported recovery event type",
      });

    return {
      completed: false,
      requiresReconciliation: true,
      eventStatusUpdated: Boolean(updated),
      reason: "Unsupported recovery event type",
    };
  }

  try {
    // 4. Verify payment with Razorpay
    //
    // evaluateWebhookRecovery() must use
    // the updated reconciliation services.
    //
    // Razorpay-only:
    //   Verify full order amount.
    //
    // Wallet + Razorpay:
    //   Verify paymentBreakdown.razorpayPaise.
    const decision = await evaluateWebhookRecovery(
      normalizedEventId
    );

    // 5. Validate recovery decision
    if (!decision || typeof decision !== "object") {
      throw new Error(
        "Invalid webhook recovery decision"
      );
    }

    // 6. Handle unsuccessful verification
    if (decision.requiresReconciliation) {
      const updated =
        await markWebhookEventForReconciliation({
          eventId: normalizedEventId,
          processingToken: normalizedToken,
          reason:
            decision.reason ||
            "Payment requires reconciliation",
        });

      return {
        completed: false,
        requiresReconciliation: true,
        eventStatusUpdated: Boolean(updated),
        reason: decision.reason,
      };
    }

    // 7. Verify confirmation eligibility
    //
    // Allowed:
    // A. Captured payment, pending order.
    // B. Same captured payment, already-paid order.
    //
    // Both pass through the transaction
    // to verify webhook ownership.
    if (
      !decision.readyForConfirmation &&
      !decision.alreadyPaid
    ) {
      const updated =
        await markWebhookEventForReconciliation({
          eventId: normalizedEventId,
          processingToken: normalizedToken,
          reason:
            "Payment is not ready for confirmation",
        });

      return {
        completed: false,
        requiresReconciliation: true,
        eventStatusUpdated: Boolean(updated),
        reason:
          "Payment is not ready for confirmation",
      };
    }

    // 8. Validate verified payment identity
    if (
      !decision.userId ||
      !decision.orderId ||
      typeof decision.razorpayOrderId !==
        "string" ||
      !/^order_[A-Za-z0-9]+$/.test(
        decision.razorpayOrderId
      ) ||
      typeof decision.razorpayPaymentId !==
        "string" ||
      !/^pay_[A-Za-z0-9]+$/.test(
        decision.razorpayPaymentId
      )
    ) {
      throw new Error(
        "Verified recovery payment details are incomplete"
      );
    }

    // 9. Confirm captured payment atomically
    //
    // The confirmation transaction must:
    //
    // - Recheck the order and payment method
    // - Validate the webhook processing token
    // - Match the Razorpay payment amount
    // - Settle reserved wallet funds for split
    // - Mark the order Paid and Confirmed
    // - Complete stock reservation
    // - Complete checkout attempt
    // - Mark the webhook event Processed
    //
    // All database changes must commit
    // in one MongoDB transaction.
    const confirmation =
      await confirmCapturedPaymentTransaction({
        userId: decision.userId,
        orderId: decision.orderId,
        razorpayOrderId:
          decision.razorpayOrderId,
        razorpayPaymentId:
          decision.razorpayPaymentId,
        webhookContext: {
          eventId: normalizedEventId,
          processingToken: normalizedToken,
        },
      });

    // 10. Return success
    //
    // No separate webhook status update.
    // The transaction already marked
    // the webhook event Processed.
    return {
      completed: true,
      alreadyPaid:
        confirmation.alreadyConfirmed === true,
      orderId: confirmation.orderId,
      paymentStatus:
        confirmation.paymentStatus,
      requiresReconciliation: false,
    };
  } catch (error) {
    // 11. Handle recovery errors
    console.error(
      "Webhook recovery execution error:",
      error.message
    );

    // Never treat an uncertain payment
    // as a failed payment.
    //
    // Never release wallet funds here.
    //
    // Only the current token holder can
    // mark the event for reconciliation.
    let updated = null;

    try {
      updated =
        await markWebhookEventForReconciliation({
          eventId: normalizedEventId,
          processingToken: normalizedToken,
          reason:
            "Recovery execution encountered an error",
        });
    } catch (statusError) {
      console.error(
        "Could not update webhook reconciliation status:",
        statusError.message
      );
    }

    return {
      completed: false,
      requiresReconciliation: true,
      eventStatusUpdated: Boolean(updated),
    };
  }
};

module.exports = {
  executeWebhookRecovery,
};
