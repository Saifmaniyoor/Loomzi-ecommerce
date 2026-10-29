const {
  claimWebhookEvent,
  markWebhookEventForReconciliation,
} = require("./webhookEventServices");

const {
  executeWebhookRecovery,
} = require("./webhookRecoveryExecutionServices");

// Process one previously registered webhook event.
const processWebhookEvent = async (eventId) => {
  // 1. Claim event atomically.
  const event = await claimWebhookEvent(eventId);

  // 2. Another worker may already own it.
  if (!event) {
    return {
      processed: false,
      reason: "Webhook event is not available for claiming",
    };
  }

  try {
    // 3. Execute existing recovery logic.
    const result = await executeWebhookRecovery({
      eventId: event.eventId,
      processingToken: event.processingToken,
    });

    // 4. Return recovery outcome.
    return {
      processed: result.completed === true,
      requiresReconciliation:
        result.requiresReconciliation === true,
      result,
    };
  } catch (error) {
    // 5. Handle unexpected recovery errors.
    console.error(
      "Webhook worker error:",
      error.message
    );

    let updated = null;

    try {
      // Only the current token owner can update
      // the webhook event.
      updated =
        await markWebhookEventForReconciliation({
          eventId: event.eventId,
          processingToken: event.processingToken,
          reason: "Unexpected webhook worker error",
        });
    } catch (statusError) {
      console.error(
        "Could not update webhook event status:",
        statusError.message
      );
    }

    // Never mark an uncertain payment as failed.
    return {
      processed: false,
      requiresReconciliation: true,
      eventStatusUpdated: Boolean(updated),
      reason: "Webhook worker encountered an error",
    };
  }
};

module.exports = {
  processWebhookEvent,
};