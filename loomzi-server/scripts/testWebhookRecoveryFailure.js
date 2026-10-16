
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { mock } = require("node:test");

const razorpay = require("../config/razorpay");

const Order = require("../models/Order");
const CheckoutAttempt = require("../models/CheckoutAttempt");
const StockReservation = require("../models/StockReservation");
const WebhookEvent = require("../models/WebhookEvent");

const {
  executeWebhookRecovery,
} = require("../services/webhookRecoveryExecutionServices");

const runTest = async () => {
  const suffix = crypto.randomBytes(12).toString("hex");

  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const razorpayOrderId = `order_${suffix}`;
  const razorpayPaymentId = `pay_${suffix}`;

  const eventId = `loomzi-failure-test-${suffix}`;
  const processingToken = crypto.randomUUID();

  let orderId = null;
  let connected = false;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    // Simulate Razorpay reporting an
    // authorized but NOT captured payment.
    // No external Razorpay API request is made.
    mock.method(
      razorpay.payments,
      "fetch",
      async () => ({
        id: razorpayPaymentId,
        order_id: razorpayOrderId,
        amount: 55000,
        currency: "INR",
        status: "authorized",
        captured: false,
      })
    );

    await mongoose.connect(process.env.MONGO_URI);
    connected = true;

    console.log("MongoDB connected");

    // ==========================================
    // CREATE SYNTHETIC ORDER
    // ==========================================

    const order = await Order.create({
      user: userId,
      items: [
        {
          product: productId,
          name: "Recovery Failure Test Product",
          price: 500,
          quantity: 1,
          lineTotal: 500,
        },
      ],
      shippingAddress: {
        fullName: "Test Customer",
        phone: "9999999999",
        addressLine1: "Test Address",
        city: "Test City",
        state: "Kerala",
        pincode: "670001",
      },
      subtotal: 500,
      shippingCharge: 50,
      tax: 0,
      totalAmount: 550,
      paymentMethod: "Razorpay",
      paymentStatus: "Pending",
      orderStatus: "Pending",
      razorpayOrderId,
      razorpayPaymentId: null,
    });

    orderId = order._id;

    await CheckoutAttempt.create({
      user: userId,
      idempotencyKey: `failure-test-${suffix}`,
      requestHash: suffix,
      order: orderId,
      razorpayOrderId,
      status: "Ready",
      amountInPaise: 55000,
      currency: "INR",
    });

    await StockReservation.create({
      order: orderId,
      user: userId,
      items: [
        {
          product: productId,
          quantity: 1,
        },
      ],
      status: "Active",
      expiresAt: new Date(
        Date.now() + 15 * 60 * 1000
      ),
    });

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
      status: "Processing",
      processingToken,
      processingStartedAt: new Date(),
    });

    console.log("Synthetic records created");

    // ==========================================
    // EXECUTE RECOVERY
    // ==========================================

    const result = await executeWebhookRecovery({
      eventId,
      processingToken,
    });

    assert.equal(result.completed, false);
    assert.equal(result.requiresReconciliation, true);
    assert.equal(result.eventStatusUpdated, true);

    console.log(
      "PASS: Uncaptured payment rejected"
    );

    // ==========================================
    // VERIFY DATABASE STATES
    // ==========================================

    const [
      savedOrder,
      savedAttempt,
      savedReservation,
      savedEvent,
    ] = await Promise.all([
      Order.findById(orderId),
      CheckoutAttempt.findOne({ order: orderId }),
      StockReservation.findOne({ order: orderId }),
      WebhookEvent.findOne({ eventId }),
    ]);

    assert.equal(savedOrder.paymentStatus, "Pending");
    assert.equal(savedOrder.orderStatus, "Pending");
    assert.equal(savedOrder.razorpayPaymentId, null);

    console.log(
      "PASS: Order remains Pending"
    );

    assert.equal(savedAttempt.status, "Ready");

    console.log(
      "PASS: Checkout attempt remains Ready"
    );

    assert.equal(savedReservation.status, "Active");
    assert.equal(savedReservation.completedAt, null);
    assert.equal(savedReservation.releasedAt, null);

    console.log(
      "PASS: Stock reservation remains Active"
    );

    assert.equal(
      savedEvent.status,
      "Requires Reconciliation"
    );

    assert.equal(savedEvent.processingToken, null);
    assert.equal(savedEvent.processingStartedAt, null);

    assert.match(
      savedEvent.lastError,
      /verification/i
    );

    console.log(
      "PASS: Webhook requires reconciliation"
    );

    // ==========================================
    // VERIFY OLD TOKEN CANNOT REPROCESS
    // ==========================================

    const retry = await executeWebhookRecovery({
      eventId,
      processingToken,
    });

    assert.equal(retry.completed, false);

    const finalOrder = await Order.findById(orderId);

    assert.equal(finalOrder.paymentStatus, "Pending");

    console.log(
      "PASS: Previous token cannot reprocess webhook"
    );

    console.log(
      "All webhook recovery failure tests passed!"
    );
  } catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    mock.restoreAll();

    if (connected) {
      try {
        await WebhookEvent.deleteOne({ eventId });

        if (orderId) {
          await StockReservation.deleteMany({
            order: orderId,
            user: userId,
          });

          await CheckoutAttempt.deleteMany({
            order: orderId,
            user: userId,
          });

          await Order.deleteOne({
            _id: orderId,
            user: userId,
          });
        }

        console.log(
          "Synthetic test records cleaned up"
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
