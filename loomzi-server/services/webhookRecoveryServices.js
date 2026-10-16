
const WebhookEvent = require("../models/WebhookEvent");

// ==========================================
// CONFIGURATION
// ==========================================

// Five minutes
const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

// ==========================================
// 1. FIND INTERRUPTED WEBHOOK EVENTS
// ==========================================

const findInterruptedWebhookEvents = async ({
  limit = 20,
} = {}) => {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "Limit must be between 1 and 100"
    );
  }

  const cutoffTime = new Date(
    Date.now() - PROCESSING_TIMEOUT_MS
  );

  const events = await WebhookEvent.find({
    status: "Processing",
    processingStartedAt: {
      $lte: cutoffTime,
    },
  })
    .select(
      "eventId eventType status attempts " +
      "processingStartedAt processingToken " +
      "createdAt updatedAt"
    )
    .sort({
      processingStartedAt: 1,
    })
    .limit(limit)
    .lean();

  return {
    count: events.length,
    events,
  };
};

// ==========================================
// 2. FIND EVENTS REQUIRING RECONCILIATION
// ==========================================

const findWebhookEventsForReconciliation = async ({
  limit = 20,
} = {}) => {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "Limit must be between 1 and 100"
    );
  }

  const events = await WebhookEvent.find({
    status: "Requires Reconciliation",
  })
    .select(
      "eventId eventType status attempts " +
      "lastError createdAt updatedAt"
    )
    .sort({
      updatedAt: 1,
    })
    .limit(limit)
    .lean();

  return {
    count: events.length,
    events,
  };
};

// ==========================================
// EXPORT SERVICES
// ==========================================

module.exports = {
  findInterruptedWebhookEvents,
  findWebhookEventsForReconciliation,
};
