
const {
  claimWebhookEvent,
  markWebhookEventForReconciliation,
} = require("./webhookEventServices");

const {
  executeWebhookRecovery,
} = require("./webhookRecoveryExecutionServices");

// ==========================================
// PROCESS WEBHOOK EVENT
// ==========================================

// Internal webhook worker.
//
// Supports:
// - Razorpay-only payment confirmation
// - Wallet + Razorpay payment confirmation
//
// Wallet-only orders do not require
// Razorpay payment.captured webhooks.
//
// This worker:
// 1. Claims a webhook event
// 2. Executes verified recovery
// 3. Returns the processing result
//
// It does NOT directly:
// - Confirm orders
// - Deduct or settle wallet funds
// - Release wallet reservations
// - Update stock
// - Mark payments as Failed
//
// The confirmation transaction handles
// atomic database changes.

const processWebhookEvent = async (eventId) => {
  // 1. Validate event ID
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    throw new Error(
      "Valid webhook event ID required"
    );
  }

  const normalizedEventId = eventId.trim();

  // 2. Claim event atomically
  //
  // claimWebhookEvent() must ensure
  // only one worker owns the event
  // at a time.
  const event = await claimWebhookEvent(
    normalizedEventId
  );

  // 3. Handle unavailable event
  //
  // Another worker may already own it,
  // or it may have been processed.
  if (!event) {
    return {
      processed: false,
      requiresReconciliation: false,
      reason:
        "Webhook event is not available for claiming",
    };
  }

  // 4. Validate claimed event ownership
  //
  // The recovery transaction must check
  // this token again before committing.
  if (
    !event.eventId ||
    typeof event.processingToken !== "string" ||
    !event.processingToken.trim()
  ) {
    throw new Error(
      "Claimed webhook event has no valid processing token"
    );
  }

  try {
    // 5. Execute verified recovery
    //
    // Recovery verifies the payment
    // with Razorpay before confirmation.
    //
    // For Wallet + Razorpay:
    // - Verify Razorpay contribution
    // - Confirm the order
    // - Settle wallet reservation once
    //
    // These database changes happen
    // inside the confirmation transaction.
    const result =
      await executeWebhookRecovery({
        eventId: event.eventId,
        processingToken:
          event.processingToken,
      });

    // 6. Validate recovery result
    if (!result || typeof result !== "object") {
      throw new Error(
        "Invalid webhook recovery result"
      );
    }

    // 7. Return processing outcome
    return {
      processed: result.completed === true,
      requiresReconciliation:
        result.requiresReconciliation === true,
      alreadyPaid:
        result.alreadyPaid === true,
      orderId: result.orderId || null,
      result,
    };
  } catch (error) {
    // 8. Handle unexpected recovery errors
    console.error(
      "Webhook worker error:",
      error.message
    );

    // A captured payment may already exist.
    // Never mark the payment as Failed
    // or release wallet funds here.
    let updated = null;

    try {
      // Only the current processing-token
      // owner may change event status.
      updated =
        await markWebhookEventForReconciliation({
          eventId: event.eventId,
          processingToken:
            event.processingToken,
          reason:
            "Unexpected webhook worker error",
        });
    } catch (statusError) {
      console.error(
        "Could not update webhook event status:",
        statusError.message
      );
    }

    return {
      processed: false,
      requiresReconciliation: true,
      eventStatusUpdated: Boolean(updated),
      reason:
        "Webhook worker encountered an error",
    };
  }
};

module.exports = {
  processWebhookEvent,
};
