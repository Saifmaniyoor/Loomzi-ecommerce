const WebhookEvent = require("../models/WebhookEvent");
const { processWebhookEvent } = require("./webhookWorkerServices");
let busy = false;
async function processReceivedWebhooks() {
  if (busy) return;
  busy = true;
  try {
    // Only captured payments are auto-confirmed. Other event types need explicit policy.
    const events = await WebhookEvent.find({ status: "Received", eventType: "payment.captured" })
      .sort({ createdAt: 1 }).limit(10).select("eventId").lean();
    for (const event of events) {
      try { await processWebhookEvent(event.eventId); }
      catch (error) { console.error("Webhook processing error:", event.eventId, error.message); }
    }
  } catch (error) { console.error("Webhook polling failed:", error.message); }
  finally { busy = false; }
}
function startWebhookPolling() {
  if (process.env.ENABLE_RAZORPAY_WEBHOOK_WORKER !== "true") return;
  const timer = setInterval(processReceivedWebhooks, 10000);
  timer.unref?.();
  processReceivedWebhooks();
}
module.exports = { startWebhookPolling, processReceivedWebhooks };
