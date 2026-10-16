
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const eventServices = require(
  "../services/webhookEventServices"
);

const decisionServices = require(
  "../services/webhookRecoveryDecisionServices"
);

const confirmationServices = require(
  "../services/paymentConfirmationTransactionServices"
);

const eventId = "evt_loomzi_recovery_test";
const processingToken = "worker-test-token";

const paymentDetails = {
  userId: "test-user",
  orderId: "test-order",
  razorpayOrderId: "order_TEST123",
  razorpayPaymentId: "pay_TEST123",
};

const runTest = async () => {
  let modulePath;

  try {
    // ==========================================
    // 1. MOCK DATABASE AND PAYMENT OPERATIONS
    // ==========================================

    mock.method(
      eventServices,
      "findWebhookEventById",
      async () => ({
        eventId,
        eventType: "payment.captured",
        status: "Processing",
        processingToken,
      })
    );

    mock.method(
      eventServices,
      "markWebhookEventForReconciliation",
      async () => ({
        eventId,
        status: "Requires Reconciliation",
      })
    );

    mock.method(
      decisionServices,
      "evaluateWebhookRecovery",
      async () => ({
        requiresReconciliation: false,
        readyForConfirmation: true,
        alreadyPaid: false,
        ...paymentDetails,
      })
    );

    mock.method(
      confirmationServices,
      "confirmCapturedPaymentTransaction",
      async () => ({
        alreadyConfirmed: false,
        orderId: paymentDetails.orderId,
        paymentStatus: "Paid",
      })
    );

    // Load the recovery service after mocks
    // because it destructures imported functions.
    modulePath = require.resolve(
      "../services/webhookRecoveryExecutionServices"
    );

    delete require.cache[modulePath];

    const {
      executeWebhookRecovery,
    } = require(modulePath);

    const input = {
      eventId,
      processingToken,
    };

    // ==========================================
    // TEST 1: SUCCESSFUL RECOVERY
    // ==========================================

    const success = await executeWebhookRecovery(input);

    assert.equal(success.completed, true);
    assert.equal(success.paymentStatus, "Paid");

    assert.equal(
      confirmationServices
        .confirmCapturedPaymentTransaction
        .mock.calls.length,
      1
    );

    const confirmationArgs =
      confirmationServices
        .confirmCapturedPaymentTransaction
        .mock.calls[0].arguments[0];

    assert.deepEqual(
      confirmationArgs.webhookContext,
      { eventId, processingToken }
    );

    console.log("PASS: Successful recovery");

    // ==========================================
    // TEST 2: INCORRECT WORKER TOKEN
    // ==========================================

    const confirmationCallsBefore =
      confirmationServices
        .confirmCapturedPaymentTransaction
        .mock.calls.length;

    const wrongToken = await executeWebhookRecovery({
      eventId,
      processingToken: "incorrect-token",
    });

    assert.equal(wrongToken.completed, false);

    assert.equal(
      confirmationServices
        .confirmCapturedPaymentTransaction
        .mock.calls.length,
      confirmationCallsBefore
    );

    console.log("PASS: Incorrect worker rejected");

    // ==========================================
    // TEST 3: PAYMENT VERIFICATION FAILURE
    // ==========================================

    decisionServices.evaluateWebhookRecovery.mock
      .mockImplementation(async () => ({
        requiresReconciliation: true,
        reason: "Payment not captured",
      }));

    const verificationFailure =
      await executeWebhookRecovery(input);

    assert.equal(
      verificationFailure.completed,
      false
    );

    assert.equal(
      verificationFailure.requiresReconciliation,
      true
    );

    assert.equal(
      verificationFailure.eventStatusUpdated,
      true
    );

    console.log(
      "PASS: Verification failure requires reconciliation"
    );

    // ==========================================
    // TEST 4: ALREADY-PAID ORDER
    // ==========================================

    decisionServices.evaluateWebhookRecovery.mock
      .mockImplementation(async () => ({
        requiresReconciliation: false,
        readyForConfirmation: false,
        alreadyPaid: true,
        ...paymentDetails,
      }));

    confirmationServices
      .confirmCapturedPaymentTransaction
      .mock.mockImplementation(async () => ({
        alreadyConfirmed: true,
        orderId: paymentDetails.orderId,
        paymentStatus: "Paid",
      }));

    const alreadyPaid =
      await executeWebhookRecovery(input);

    assert.equal(alreadyPaid.completed, true);
    assert.equal(alreadyPaid.alreadyPaid, true);

    console.log(
      "PASS: Already-paid order handled"
    );

    // ==========================================
    // TEST 5: CONFIRMATION ERROR
    // ==========================================

    confirmationServices
      .confirmCapturedPaymentTransaction
      .mock.mockImplementation(async () => {
        throw new Error(
          "Simulated transaction failure"
        );
      });

    const confirmationFailure =
      await executeWebhookRecovery(input);

    assert.equal(
      confirmationFailure.completed,
      false
    );

    assert.equal(
      confirmationFailure.requiresReconciliation,
      true
    );

    console.log(
      "PASS: Transaction failure requires reconciliation"
    );

    console.log(
      "All webhook recovery execution tests passed!"
    );
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
