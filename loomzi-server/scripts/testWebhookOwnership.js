
const mongoose = require("mongoose");

const WebhookEvent = require("../models/WebhookEvent");

const {
  markWebhookEventProcessed,
} = require("../services/webhookEventServices");

const runTest = async () => {
  let testEventId = null;

  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    // 2. Generate a unique test event ID
    testEventId = `loomzi-ownership-test-${Date.now()}`;

    const correctToken = "correct-test-token";
    const incorrectToken = "incorrect-test-token";

    // 3. Create a synthetic webhook event
    await WebhookEvent.create({
      eventId: testEventId,
      eventType: "payment.captured",
      payload: {
        event: "payment.captured",
      },
      status: "Processing",
      processingToken: correctToken,
      processingStartedAt: new Date(),
    });

    console.log("Test webhook created");

    // 4. Try processing with incorrect token
    const incorrectResult =
      await markWebhookEventProcessed({
        eventId: testEventId,
        processingToken: incorrectToken,
      });

    if (incorrectResult !== null) {
      throw new Error(
        "SECURITY TEST FAILED: Incorrect token was accepted"
      );
    }

    console.log(
      "PASS: Incorrect processing token rejected"
    );

    // 5. Check event is still Processing
    const unchangedEvent = await WebhookEvent.findOne({
      eventId: testEventId,
    });

    if (
      !unchangedEvent ||
      unchangedEvent.status !== "Processing" ||
      unchangedEvent.processingToken !== correctToken
    ) {
      throw new Error(
        "SECURITY TEST FAILED: Event changed unexpectedly"
      );
    }

    console.log(
      "PASS: Event ownership remained unchanged"
    );

    // 6. Try processing with correct token
    const correctResult =
      await markWebhookEventProcessed({
        eventId: testEventId,
        processingToken: correctToken,
      });

    if (
      !correctResult ||
      correctResult.status !== "Processed"
    ) {
      throw new Error(
        "TEST FAILED: Correct token was rejected"
      );
    }

    console.log(
      "PASS: Correct processing token accepted"
    );

    // 7. Verify token was cleared
    const completedEvent = await WebhookEvent.findOne({
      eventId: testEventId,
    });

    if (
      !completedEvent ||
      completedEvent.status !== "Processed" ||
      completedEvent.processingToken !== null
    ) {
      throw new Error(
        "TEST FAILED: Event completion state incorrect"
      );
    }

    console.log(
      "PASS: Processing token cleared after completion"
    );

    console.log(
      "All webhook ownership tests passed!"
    );
  } catch (error) {
    console.error("Test failed:", error.message);
    process.exitCode = 1;
  } finally {
    // Remove only the synthetic record created
    // by this test, never real Razorpay events.
    if (testEventId && mongoose.connection.readyState === 1) {
      await WebhookEvent.deleteOne({
        eventId: testEventId,
      });
    }

    await mongoose.disconnect();
  }
};

runTest();
