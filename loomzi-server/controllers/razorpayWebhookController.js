
const {
  verifyRazorpayWebhookSignature,
} = require("../utils/razorpayWebhookSignature");

const {
  validateRazorpayWebhookPayload,
} = require("../utils/razorpayWebhookPayload");

const {
  registerWebhookEvent,
} = require("../services/webhookEventServices");

const receiveRazorpayWebhook = async (req, res) => {
  try {
    // 1. Verify Razorpay webhook signature.
    const signature = req.get("x-razorpay-signature");

    const isValidSignature =
      verifyRazorpayWebhookSignature({
        rawBody: req.body,
        signature,
      });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature",
      });
    }

    // 2. Validate unique event ID.
    const eventId = req.get("x-razorpay-event-id");

    if (
      typeof eventId !== "string" ||
      !eventId.trim() ||
      eventId.length > 255
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid webhook event ID",
      });
    }

    // 3. Parse verified JSON payload.
    let payload;

    try {
      payload = JSON.parse(
        req.body.toString("utf8")
      );
    } catch {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook JSON",
      });
    }

    // 4. Validate Razorpay event payload.
    const validation =
      validateRazorpayWebhookPayload(payload);

    if (!validation.valid) {
      if (validation.unsupported) {
        return res.status(200).json({
          success: true,
          message: "Unsupported event ignored",
        });
      }

      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    // 5. Register verified event and payload.
    const result = await registerWebhookEvent({
      eventId: eventId.trim(),
      eventType: validation.eventType,
      payload,
    });

    // 6. Handle old events without stored payloads.
    if (result.requiresReconciliation) {
      return res.status(409).json({
        success: false,
        message:
          "Existing webhook event requires reconciliation",
      });
    }

    // 7. Event registration only.
    // Payment processing is NOT enabled yet.
    return res.status(200).json({
      success: true,
      duplicate: result.isDuplicate,
      message: result.isDuplicate
        ? "Webhook event already registered"
        : "Webhook event registered successfully",
    });
  } catch (error) {
    console.error(
      "Razorpay webhook error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

module.exports = {
  receiveRazorpayWebhook,
};
