
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const razorpay = require("../config/razorpay");
const paymentServices = require("../services/paymentServices");
const orderMatchingServices = require(
  "../services/webhookOrderMatchingServices"
);

// Use controlled functions before loading
// the reconciliation service.
const razorpayOrderId = "order_ABC123456";
const razorpayPaymentId = "pay_ABC123456";
const amountInPaise = 55000;

const capturedPayment = {
  id: razorpayPaymentId,
  order_id: razorpayOrderId,
  amount: amountInPaise,
  currency: "INR",
  status: "captured",
  captured: true,
};

const runTest = async () => {
  let reconciliationPath;

  try {
    // Prevent actual Razorpay API calls.
    mock.method(
      razorpay.payments,
      "fetch",
      async () => ({ ...capturedPayment })
    );

    // Replace database order matching with
    // a controlled test response.
    mock.method(
      orderMatchingServices,
      "matchWebhookOrder",
      async () => ({
        matched: true,
        alreadyPaid: false,
        userId: "test-user",
        orderId: "test-order",
      })
    );

    // CommonJS destructuring captures exports
    // when the module is first loaded.
    // Temporarily replace the exported matcher
    // before loading the reconciliation module.
    const reconciliationModulePath =
      require.resolve(
        "../services/webhookPaymentReconciliationServices"
      );

    reconciliationPath = reconciliationModulePath;

    delete require.cache[reconciliationModulePath];

    const {
      verifyWebhookCapturedPayment,
    } = require(reconciliationModulePath);

    const input = {
      razorpayOrderId,
      razorpayPaymentId,
      amountInPaise,
    };

    // ==========================================
    // TEST 1: CAPTURED PAYMENT
    // ==========================================

    const success =
      await verifyWebhookCapturedPayment(input);

    assert.equal(success.verified, true);
    assert.equal(success.alreadyPaid, false);

    console.log(
      "PASS: Captured payment verified"
    );

    // ==========================================
    // TEST 2: FAILED PAYMENT
    // ==========================================

    razorpay.payments.fetch.mock.mockImplementation(
      async () => ({
        ...capturedPayment,
        status: "failed",
        captured: false,
      })
    );

    const failed =
      await verifyWebhookCapturedPayment(input);

    assert.equal(failed.verified, false);
    assert.equal(failed.requiresReconciliation, true);

    console.log(
      "PASS: Failed payment rejected"
    );

    // ==========================================
    // TEST 3: WRONG AMOUNT
    // ==========================================

    razorpay.payments.fetch.mock.mockImplementation(
      async () => ({
        ...capturedPayment,
        amount: 50000,
      })
    );

    const wrongAmount =
      await verifyWebhookCapturedPayment(input);

    assert.equal(wrongAmount.verified, false);

    console.log(
      "PASS: Incorrect payment amount rejected"
    );

    // ==========================================
    // TEST 4: RAZORPAY API ERROR
    // ==========================================

    razorpay.payments.fetch.mock.mockImplementation(
      async () => {
        throw new Error("Simulated Razorpay outage");
      }
    );

    await assert.rejects(
      verifyWebhookCapturedPayment(input),
      /Simulated Razorpay outage/
    );

    console.log(
      "PASS: Provider error propagated for reconciliation"
    );

    // ==========================================
    // TEST 5: ALREADY-PAID ORDER
    // ==========================================

    razorpay.payments.fetch.mock.mockImplementation(
      async () => ({ ...capturedPayment })
    );

    orderMatchingServices.matchWebhookOrder.mock
      .mockImplementation(async () => ({
        matched: true,
        alreadyPaid: true,
        razorpayPaymentId,
        userId: "test-user",
        orderId: "test-order",
      }));

    const alreadyPaid =
      await verifyWebhookCapturedPayment(input);

    assert.equal(alreadyPaid.verified, true);
    assert.equal(alreadyPaid.alreadyPaid, true);

    console.log(
      "PASS: Already-paid order verified"
    );

    console.log(
      "All webhook payment verification tests passed!"
    );
  } catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    mock.restoreAll();

    if (reconciliationPath) {
      delete require.cache[reconciliationPath];
    }
  }
};

runTest();
