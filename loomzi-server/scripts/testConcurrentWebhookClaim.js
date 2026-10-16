
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const WebhookEvent = require("../models/WebhookEvent");

const {
  claimWebhookEvent,
} = require("../services/webhookEventServices");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runTest = async () => {
  const suffix = crypto.randomBytes(12).toString("hex");
  const eventId = `loomzi-concurrent-test-${suffix}`;

  const razorpayOrderId = `order_${suffix}`;
  const razorpayPaymentId = `pay_${suffix}`;

  let connected = false;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    await mongoose.connect(process.env.MONGO_URI);
    connected = true;

    console.log("MongoDB connected");

    // Create a synthetic received webhook.
    await WebhookEvent.create({
      eventId,
      eventType: "payment.captured",
      payload: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: razorpayPaymentId,
              order_id: razorpayOrderId,
              amount: 55000,
              currency: "INR",
              status: "captured",
              captured: true,
            },
          },
        },
        testOnly: true,
      },
      status: "Received",
    });

    // Two workers attempt to claim
    // the same event concurrently.
    const [workerA, workerB] = await Promise.all([
      claimWebhookEvent(eventId),
      claimWebhookEvent(eventId),
    ]);

    const successfulClaims =
      [workerA, workerB].filter(Boolean);

    assert(
      successfulClaims.length === 1,
      "SECURITY TEST FAILED: Multiple workers claimed the event"
    );

    const claimedEvent = successfulClaims[0];

    assert(
      claimedEvent.status === "Processing" &&
        typeof claimedEvent.processingToken === "string" &&
        claimedEvent.processingToken.length > 0,
      "Claimed event has invalid ownership details"
    );

    const savedEvent = await WebhookEvent.findOne({
      eventId,
    });

    assert(
      savedEvent.status === "Processing" &&
        savedEvent.processingToken ===
          claimedEvent.processingToken &&
        savedEvent.attempts === 1,
      "Stored webhook ownership is inconsistent"
    );

    console.log(
      "PASS: Only one worker claimed the webhook"
    );

    console.log(
      "PASS: Processing token and attempt count are correct"
    );

    // A third worker must also fail.
    const thirdWorker = await claimWebhookEvent(eventId);

    assert(
      thirdWorker === null,
      "Already-claimed webhook was claimed again"
    );

    console.log(
      "PASS: Already-claimed webhook cannot be claimed again"
    );

    console.log(
      "All concurrent webhook claim tests passed!"
    );
  } catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    if (connected) {
      try {
        await WebhookEvent.deleteOne({ eventId });

        console.log(
          "Synthetic test record cleaned up"
        );
      } catch (error) {
        console.error(
          "Cleanup failed:",
          error.message
        );

        process.exitCode = 1;
      }

      await mongoose.disconnect();
    }
  }
};

runTest();
