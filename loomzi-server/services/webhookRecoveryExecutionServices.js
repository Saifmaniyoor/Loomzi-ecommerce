
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

// Execute recovery for an already-claimed webhook.
//
// IMPORTANT:
// Do not expose this function through a public API.
// The caller must supply the current processing token.

const executeWebhookRecovery = async ({
  eventId,
  processingToken,
}) => {
  // ==========================================
  // 1. VALIDATE INPUTS
  // ==========================================

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

  // ==========================================
  // 2. VERIFY INITIAL WEBHOOK OWNERSHIP
  // ==========================================

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

  // ==========================================
  // 3. CHECK WEBHOOK EVENT TYPE
  // ==========================================

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
    // ==========================================
    // 4. VERIFY PAYMENT WITH RAZORPAY
    // ==========================================

    const decision = await evaluateWebhookRecovery(
      normalizedEventId
    );

    // ==========================================
    // 5. HANDLE UNSUCCESSFUL VERIFICATION
    // ==========================================

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

    // ==========================================
    // 6. CHECK WHETHER CONFIRMATION IS ALLOWED
    // ==========================================

    // Both cases are allowed:
    //
    // A. Payment captured but order still Pending
    // B. Same payment already confirmed in Loomzi
    //
    // Both must pass through the same transaction
    // to validate the stored webhook payment.

    if (
      !decision.readyForConfirmation &&
      !decision.alreadyPaid
    ) {
      const updated =
        await markWebhookEventForReconciliation({
          eventId: normalizedEventId,
          processingToken: normalizedToken,
          reason: "Payment is not ready for confirmation",
        });

      return {
        completed: false,
        requiresReconciliation: true,
        eventStatusUpdated: Boolean(updated),
      };
    }

    // ==========================================
    // 7. CONFIRM PAYMENT ATOMICALLY
    // ==========================================

    // The transaction will:
    //
    // 1. Find the matching Loomzi order
    // 2. Check the webhook processing token
    // 3. Validate stored webhook payment details
    // 4. Confirm the payment if still Pending
    // 5. Complete the stock reservation
    // 6. Complete the checkout attempt
    // 7. Mark the webhook event Processed
    //
    // If the order is already Paid using the
    // same Razorpay payment, it will safely
    // complete the webhook without repeating
    // the order or stock updates.

    const confirmation =
      await confirmCapturedPaymentTransaction({
        userId: decision.userId,
        orderId: decision.orderId,
        razorpayOrderId: decision.razorpayOrderId,
        razorpayPaymentId: decision.razorpayPaymentId,
        webhookContext: {
          eventId: normalizedEventId,
          processingToken: normalizedToken,
        },
      });

    // ==========================================
    // 8. RETURN SUCCESS
    // ==========================================

    // No separate markWebhookEventProcessed()
    // call is required.
    //
    // The MongoDB transaction already completed
    // the webhook event.

    return {
      completed: true,
      alreadyPaid: confirmation.alreadyConfirmed,
      orderId: confirmation.orderId,
      paymentStatus: confirmation.paymentStatus,
      requiresReconciliation: false,
    };
  } catch (error) {
    // ==========================================
    // 9. HANDLE RECOVERY ERRORS
    // ==========================================

    console.error(
      "Webhook recovery execution error:",
      error.message
    );

    // Never mark the payment as Failed here.
    //
    // Razorpay may already have captured it.
    // Only the current token holder may mark
    // this event for reconciliation.

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
