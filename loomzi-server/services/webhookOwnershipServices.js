
const WebhookEvent = require("../models/WebhookEvent");

// Check whether a worker still owns a webhook.
//
// When called with a MongoDB session, this query
// participates in the caller's transaction.
//
// IMPORTANT:
// This is a read-only ownership check.
// It does not lock the webhook record.

const verifyWebhookOwnership = async ({
  eventId,
  processingToken,
  session,
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

  const query = WebhookEvent.findOne({
    eventId: eventId.trim(),
    status: "Processing",
    processingToken: processingToken.trim(),
  });

  if (session) {
    query.session(session);
  }

  const event = await query;

  return {
    owned: Boolean(event),
    eventId: eventId.trim(),
  };
};

module.exports = {
  verifyWebhookOwnership,
};
