
const crypto = require("node:crypto");

const WebhookEvent = require("../models/WebhookEvent");

// ==========================================
// HELPERS
// ==========================================

const normalizeEventId = (eventId) => {
  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    eventId.trim().length > 255
  ) {
    throw new Error("Valid webhook event ID required");
  }

  return eventId.trim();
};

const normalizeProcessingToken = (token) => {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Valid webhook processing token required"
    );
  }

  return token.trim();
};

const hashPayload = (payload) => {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
};

// ==========================================
// 1. REGISTER WEBHOOK EVENT
// ==========================================

// IMPORTANT:
// The controller must authenticate the
// Razorpay webhook signature BEFORE
// registering the event.
//
// This service does not verify signatures.

const registerWebhookEvent = async ({
  eventId,
  eventType,
  payload,
}) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  if (
    typeof eventType !== "string" ||
    !eventType.trim() ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      "Invalid webhook registration details"
    );
  }

  const normalizedEventType =
    eventType.trim();

  if (payload.event !== normalizedEventType) {
    throw new Error(
      "Webhook event type does not match payload"
    );
  }

  const payloadHash = hashPayload(payload);

  try {
    const event = await WebhookEvent.create({
      eventId: normalizedEventId,
      eventType: normalizedEventType,
      payload,
      status: "Received",
    });

    return {
      event,
      isDuplicate: false,
    };
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    const existingEvent =
      await WebhookEvent.findOne({
        eventId: normalizedEventId,
      });

    if (!existingEvent) {
      throw error;
    }

    const existingPayloadHash =
      existingEvent.payload == null
        ? null
        : hashPayload(existingEvent.payload);

    if (
      existingEvent.eventType !==
        normalizedEventType ||
      (
        existingPayloadHash !== null &&
        existingPayloadHash !== payloadHash
      )
    ) {
      throw new Error(
        "Webhook event ID conflicts with existing event data"
      );
    }

    if (existingPayloadHash === null) {
      return {
        event: existingEvent,
        isDuplicate: true,
        requiresReconciliation: true,
      };
    }

    return {
      event: existingEvent,
      isDuplicate: true,
    };
  }
};

// ==========================================
// 2. CLAIM NEW WEBHOOK EVENT
// ==========================================

// Only events in Received status
// can be claimed by a new worker.

const claimWebhookEvent = async (eventId) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  const processingToken =
    crypto.randomUUID();

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: normalizedEventId,
      status: "Received",
      payload: {
        $exists: true,
        $ne: null,
      },
    },
    {
      $set: {
        status: "Processing",
        processingToken,
        processingStartedAt: new Date(),
        lastError: null,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ==========================================
// 3. FIND WEBHOOK EVENT
// ==========================================

const findWebhookEventById = async (eventId) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  return WebhookEvent.findOne({
    eventId: normalizedEventId,
  });
};

// ==========================================
// 4. MARK WEBHOOK EVENT PROCESSED
// ==========================================

// Only the current processing-token owner
// can mark an event as Processed.
//
// The payment confirmation transaction
// should normally perform this update
// within its MongoDB session.

const markWebhookEventProcessed = async ({
  eventId,
  processingToken,
}) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  const normalizedToken =
    normalizeProcessingToken(
      processingToken
    );

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: normalizedEventId,
      status: "Processing",
      processingToken: normalizedToken,
    },
    {
      $set: {
        status: "Processed",
        processedAt: new Date(),
        lastError: null,
        processingStartedAt: null,
        processingToken: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ==========================================
// 5. MARK EVENT FOR RECONCILIATION
// ==========================================

// This does NOT:
// - Mark an order as Failed
// - Release wallet funds
// - Cancel stock reservations
// - Refund a payment

const markWebhookEventForReconciliation = async ({
  eventId,
  processingToken,
  reason,
}) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  const normalizedToken =
    normalizeProcessingToken(
      processingToken
    );

  if (
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    throw new Error(
      "Valid reconciliation reason required"
    );
  }

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: normalizedEventId,
      status: "Processing",
      processingToken: normalizedToken,
    },
    {
      $set: {
        status: "Requires Reconciliation",
        lastError: reason.trim().slice(0, 500),
        processingStartedAt: null,
        processingToken: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ==========================================
// 6. CLAIM EVENT FOR RECOVERY
// ==========================================

// Only events requiring reconciliation
// can be claimed through this method.

const claimWebhookEventForRecovery = async (
  eventId
) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  const processingToken =
    crypto.randomUUID();

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: normalizedEventId,
      status: "Requires Reconciliation",
      payload: {
        $exists: true,
        $ne: null,
      },
    },
    {
      $set: {
        status: "Processing",
        processingToken,
        processingStartedAt: new Date(),
        lastError: null,
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ==========================================
// 7. RECLAIM INTERRUPTED EVENT
// ==========================================

// An interrupted event may be reclaimed
// after 5 minutes.
//
// IMPORTANT:
// The MongoDB query independently checks
// the expiry cutoff.
//
// This prevents an event from being
// reclaimed using stale ownership data.

const reclaimInterruptedWebhookEvent = async ({
  eventId,
  expectedProcessingToken,
  expectedProcessingStartedAt,
}) => {
  const normalizedEventId =
    normalizeEventId(eventId);

  const previousToken =
    normalizeProcessingToken(
      expectedProcessingToken
    );

  if (!expectedProcessingStartedAt) {
    throw new Error(
      "Previous processing start time required"
    );
  }

  const previousStart = new Date(
    expectedProcessingStartedAt
  );

  if (
    Number.isNaN(previousStart.getTime())
  ) {
    throw new Error(
      "Invalid previous processing start time"
    );
  }

  const cutoffTime = new Date(
    Date.now() - 5 * 60 * 1000
  );

  // Do not reclaim a recently claimed event.
  if (previousStart > cutoffTime) {
    return null;
  }

  const newProcessingToken =
    crypto.randomUUID();

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: normalizedEventId,
      status: "Processing",
      processingToken: previousToken,

      // Both conditions must match:
      // 1. Same original processing time
      // 2. Claim is at least 5 minutes old
      processingStartedAt: {
        $eq: previousStart,
        $lte: cutoffTime,
      },

      payload: {
        $exists: true,
        $ne: null,
      },
    },
    {
      $set: {
        processingToken: newProcessingToken,
        processingStartedAt: new Date(),
      },
      $inc: {
        attempts: 1,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

// ==========================================
// EXPORT SERVICES
// ==========================================

module.exports = {
  registerWebhookEvent,
  claimWebhookEvent,
  claimWebhookEventForRecovery,
  reclaimInterruptedWebhookEvent,
  findWebhookEventById,
  markWebhookEventProcessed,
  markWebhookEventForReconciliation,
};
