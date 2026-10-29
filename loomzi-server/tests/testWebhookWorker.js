require("dotenv").config();
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const eventServices = require("../services/webhookEventServices");

const recoveryServices = require("../services/webhookRecoveryExecutionServices");

const runTest = async () => {
  let modulePath;

  try {
    const eventId = "evt_worker_test";
    const processingToken = "test-worker-token";

    // Mock successful webhook claim
    mock.method(eventServices, "claimWebhookEvent", async () => ({
      eventId,
      processingToken,
      status: "Processing",
    }));

    // Mock successful payment recovery
    mock.method(recoveryServices, "executeWebhookRecovery", async () => ({
      completed: true,
      requiresReconciliation: false,
      paymentStatus: "Paid",
    }));

    // Import worker after applying mocks
    modulePath = require.resolve("../services/webhookWorkerServices");

    delete require.cache[modulePath];

    const { processWebhookEvent } = require(modulePath);

    // TEST 1: Successful processing
    const result = await processWebhookEvent(eventId);

    assert.equal(result.processed, true);
    assert.equal(result.requiresReconciliation, false);

    assert.equal(recoveryServices.executeWebhookRecovery.mock.calls.length, 1);

    assert.deepEqual(
      recoveryServices.executeWebhookRecovery.mock.calls[0].arguments[0],
      { eventId, processingToken },
    );

    console.log("PASS: Webhook processed successfully");

    // TEST 2: Already claimed event
    eventServices.claimWebhookEvent.mock.mockImplementation(async () => null);

    const duplicate = await processWebhookEvent(eventId);

    assert.equal(duplicate.processed, false);

    assert.equal(recoveryServices.executeWebhookRecovery.mock.calls.length, 1);

    console.log("PASS: Already-claimed event rejected");

    // TEST 3: Unexpected recovery error

    // Restore a successful claim for this test.
    eventServices.claimWebhookEvent.mock.mockImplementation(async () => ({
      eventId,
      processingToken,
      status: "Processing",
    }));

    // Simulate an unexpected recovery error.
    recoveryServices.executeWebhookRecovery.mock.mockImplementation(
      async () => {
        throw new Error("Simulated recovery failure");
      },
    );

    // Mock the reconciliation status update.
    mock.method(
      eventServices,
      "markWebhookEventForReconciliation",
      async () => ({
        eventId,
        status: "Requires Reconciliation",
      }),
    );

    // Reload worker to pick up the new mock.
    delete require.cache[modulePath];

    const { processWebhookEvent: processWebhookEventWithError } = require(
      modulePath,
    );

    const errorResult = await processWebhookEventWithError(eventId);

    assert.equal(errorResult.processed, false);
    assert.equal(errorResult.requiresReconciliation, true);
    assert.equal(errorResult.eventStatusUpdated, true);

    console.log("PASS: Unexpected recovery error handled");

    console.log("All webhook worker tests passed!");
  } catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    mock.restoreAll();

    if (modulePath) {
      delete require.cache[modulePath];
    }
  }
};

runTest();
