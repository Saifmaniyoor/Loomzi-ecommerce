
const crypto = require("node:crypto");

const WebhookEvent = require("../models/WebhookEvent");

// ==========================================
// 1. REGISTER WEBHOOK EVENT
// ==========================================

// Register a verified Razorpay webhook event.
//
// IMPORTANT:
// The controller must verify the Razorpay
// signature BEFORE calling this function.

const registerWebhookEvent = async ({
  eventId,
  eventType,
  payload,
}) => {
  // Validate event details
  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    eventId.length > 255 ||
    typeof eventType !== "string" ||
    !eventType.trim() ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.event !== eventType
  ) {
    throw new Error(
      "Invalid webhook event registration details"
    );
  }

  const normalizedEventId = eventId.trim();
  const normalizedEventType = eventType.trim();

  // Generate a fingerprint of the payload
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  try {
    // Save a new webhook event
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
    // Handle duplicate event IDs
    if (error.code !== 11000) {
      throw error;
    }

    const existingEvent = await WebhookEvent.findOne({
      eventId: normalizedEventId,
    });

    if (!existingEvent) {
      throw error;
    }

    // Compare existing event payload
    const existingPayloadHash =
      existingEvent.payload == null
        ? null
        : crypto
            .createHash("sha256")
            .update(JSON.stringify(existingEvent.payload))
            .digest("hex");

    // Prevent mismatched duplicate events
    if (
      existingEvent.eventType !== normalizedEventType ||
      (existingPayloadHash !== null &&
        existingPayloadHash !== payloadHash)
    ) {
      throw new Error(
        "Webhook event ID conflicts with existing event data"
      );
    }

    // Older events may not contain payload data
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
// 2. CLAIM WEBHOOK EVENT
// ==========================================

// Atomically claim a newly received event.
// A unique processing token is generated
// for the worker claiming the event.

const claimWebhookEvent = async (eventId) => {
  // Validate event ID
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    throw new Error(
      "Valid webhook event ID required"
    );
  }

  // Generate a unique processing token
  const processingToken = crypto.randomUUID();

  // Atomically claim the event
  const event = await WebhookEvent.findOneAndUpdate(
    {
      eventId: eventId.trim(),
      status: "Received",
      payload: { $ne: null },
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  // Returns null if the event was already claimed
  return event;
};

// ==========================================
// 3. FIND WEBHOOK EVENT
// ==========================================

const findWebhookEventById = async (eventId) => {
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    throw new Error(
      "Valid webhook event ID required"
    );
  }

  return WebhookEvent.findOne({
    eventId: eventId.trim(),
  });
};

// ==========================================
// 4. MARK WEBHOOK EVENT AS PROCESSED
// ==========================================

// Only the worker holding the matching
// processing token can mark the event processed.

const markWebhookEventProcessed = async ({
  eventId,
  processingToken,
}) => {
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

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: eventId.trim(),
      status: "Processing",
      processingToken: processingToken.trim(),
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
      returnDocument: "after",
      runValidators: true,
    }
  );
};

// ==========================================
// 5. MARK EVENT FOR RECONCILIATION
// ==========================================

// Mark an event as requiring investigation.
// This does NOT update any order payment status.

const markWebhookEventForReconciliation = async ({
  eventId,
  processingToken,
  reason,
}) => {
  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    typeof processingToken !== "string" ||
    !processingToken.trim() ||
    typeof reason !== "string" ||
    !reason.trim()
  ) {
    throw new Error(
      "Valid event ID, processing token and reason required"
    );
  }

  return WebhookEvent.findOneAndUpdate(
    {
      eventId: eventId.trim(),
      status: "Processing",
      processingToken: processingToken.trim(),
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
      returnDocument: "after",
      runValidators: true,
    }
  );
};


const claimWebhookEventForRecovery = async (
  eventId
) => {
  // 1. Validate event ID
  if (
    typeof eventId !== "string" ||
    !eventId.trim()
  ) {
    throw new Error(
      "Valid webhook event ID required"
    );
  }

  // 2. Generate a new ownership token
  const processingToken = crypto.randomUUID();

  // 3. Atomically claim an event that
  // requires reconciliation.
  const event = await WebhookEvent.findOneAndUpdate(
    {
      eventId: eventId.trim(),
      status: "Requires Reconciliation",
      payload: { $ne: null },
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return event;
};


const reclaimInterruptedWebhookEvent = async ({
  eventId,
  expectedProcessingToken,
  expectedProcessingStartedAt,
}) => {
  // 1. Validate inputs
  if (
    typeof eventId !== "string" ||
    !eventId.trim() ||
    typeof expectedProcessingToken !== "string" ||
    !expectedProcessingToken.trim() ||
    !expectedProcessingStartedAt
  ) {
    throw new Error(
      "Valid event ID and previous processing details required"
    );
  }

  const previousStart = new Date(
    expectedProcessingStartedAt
  );

  if (Number.isNaN(previousStart.getTime())) {
    throw new Error(
      "Invalid previous processing start time"
    );
  }

  // 2. Only consider events older than 5 minutes
  const cutoffTime = new Date(
    Date.now() - 5 * 60 * 1000
  );

  if (previousStart > cutoffTime) {
    return null;
  }

  // 3. Generate a new processing token
  const newProcessingToken = crypto.randomUUID();

  // 4. Atomically replace ownership only if
  // the stored values still match.
  const event = await WebhookEvent.findOneAndUpdate(
    {
      eventId: eventId.trim(),
      status: "Processing",
      processingToken:
        expectedProcessingToken.trim(),
      processingStartedAt: previousStart,
      payload: { $ne: null },
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return event;
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