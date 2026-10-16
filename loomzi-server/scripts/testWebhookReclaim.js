
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const WebhookEvent = require("../models/WebhookEvent");

const {
  reclaimInterruptedWebhookEvent,
  markWebhookEventProcessed,
  markWebhookEventForReconciliation,
} = require("../services/webhookEventServices");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runTest = async () => {
  const eventId =
    `loomzi-reclaim-test-${crypto.randomUUID()}`;

  const oldToken = crypto.randomUUID();

  let connected = false;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    await mongoose.connect(process.env.MONGO_URI);
    connected = true;

    console.log("MongoDB connected");

    // ==========================================
    // 1. CREATE INTERRUPTED WEBHOOK
    // ==========================================

    const oldStartTime = new Date(
      Date.now() - 10 * 60 * 1000
    );

    const event = await WebhookEvent.create({
      eventId,
      eventType: "payment.captured",
      payload: {
        event: "payment.captured",
        testOnly: true,
      },
      status: "Processing",
      processingToken: oldToken,
      processingStartedAt: oldStartTime,
    });

    console.log("Synthetic interrupted event created");

    // ==========================================
    // TEST 1: INCORRECT TOKEN CANNOT RECLAIM
    // ==========================================

    const incorrectReclaim =
      await reclaimInterruptedWebhookEvent({
        eventId,
        expectedProcessingToken: crypto.randomUUID(),
        expectedProcessingStartedAt:
          event.processingStartedAt,
      });

    assert(
      incorrectReclaim === null,
      "Incorrect token was allowed to reclaim webhook"
    );

    console.log(
      "PASS: Incorrect token cannot reclaim webhook"
    );

    // ==========================================
    // TEST 2: TWO WORKERS ATTEMPT RECLAIM
    // ==========================================

    const [workerA, workerB] = await Promise.all([
      reclaimInterruptedWebhookEvent({
        eventId,
        expectedProcessingToken: oldToken,
        expectedProcessingStartedAt:
          event.processingStartedAt,
      }),
      reclaimInterruptedWebhookEvent({
        eventId,
        expectedProcessingToken: oldToken,
        expectedProcessingStartedAt:
          event.processingStartedAt,
      }),
    ]);

    const successfulReclaims =
      [workerA, workerB].filter(Boolean);

    assert(
      successfulReclaims.length === 1,
      "Multiple workers reclaimed the same webhook"
    );

    const reclaimed = successfulReclaims[0];

    assert(
      reclaimed.status === "Processing" &&
        reclaimed.processingToken &&
        reclaimed.processingToken !== oldToken,
      "Reclaimed event has invalid ownership"
    );

    console.log(
      "PASS: Only one recovery worker reclaimed webhook"
    );

    // ==========================================
    // TEST 3: OLD WORKER CANNOT PROCESS EVENT
    // ==========================================

    const oldWorkerResult =
      await markWebhookEventProcessed({
        eventId,
        processingToken: oldToken,
      });

    assert(
      oldWorkerResult === null,
      "Old worker was allowed to process webhook"
    );

    console.log(
      "PASS: Old worker cannot process webhook"
    );

    // ==========================================
    // TEST 4: OLD WORKER CANNOT CHANGE STATUS
    // ==========================================

    const oldWorkerReconciliation =
      await markWebhookEventForReconciliation({
        eventId,
        processingToken: oldToken,
        reason: "Stale worker attempted update",
      });

    assert(
      oldWorkerReconciliation === null,
      "Old worker changed webhook reconciliation status"
    );

    console.log(
      "PASS: Old worker cannot change reconciliation status"
    );

    // ==========================================
    // TEST 5: VERIFY NEW WORKER OWNERSHIP
    // ==========================================

    const savedEvent = await WebhookEvent.findOne({
      eventId,
    });

    assert(
      savedEvent.status === "Processing" &&
        savedEvent.processingToken ===
          reclaimed.processingToken &&
        savedEvent.attempts === 1,
      "New worker ownership was not preserved"
    );

    console.log(
      "PASS: New worker ownership preserved"
    );

    // ==========================================
    // TEST 6: NEW WORKER CAN PROCESS EVENT
    // ==========================================

    // This tests token-based status updates only.
    // It does not verify a Razorpay payment.

    const newWorkerResult =
      await markWebhookEventProcessed({
        eventId,
        processingToken: reclaimed.processingToken,
      });

    assert(
      newWorkerResult &&
        newWorkerResult.status === "Processed",
      "New worker could not complete webhook"
    );

    const finalEvent = await WebhookEvent.findOne({
      eventId,
    });

    assert(
      finalEvent.status === "Processed" &&
        finalEvent.processingToken === null &&
        finalEvent.processedAt != null,
      "Incorrect final webhook state"
    );

    console.log(
      "PASS: New worker can complete webhook"
    );

    console.log(
      "All webhook reclaim ownership tests passed!"
    );
  } catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    // ==========================================
    // CLEAN UP SYNTHETIC TEST EVENT
    // ==========================================

    if (connected) {
      try {
        await WebhookEvent.deleteOne({ eventId });

        console.log(
          "Synthetic test event cleaned up"
        );
      } catch (cleanupError) {
        console.error(
          "Cleanup failed:",
          cleanupError.message
        );

        process.exitCode = 1;
      }

      await mongoose.disconnect();
    }
  }
};

runTest();
