
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

  const eventId = `loomzi-full-recovery-${suffix}`;
  const processingToken = crypto.randomUUID();

  let orderId = null;
  let connected = false;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    // Mock Razorpay before executing recovery.
    mock.method(
      razorpay.payments,
      "fetch",
      async () => ({
        id: razorpayPaymentId,
        order_id: razorpayOrderId,
        amount: 55000,
        currency: "INR",
        status: "captured",
        captured: true,
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
          name: "Recovery Test Product",
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
      idempotencyKey: `recovery-${suffix}`,
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
    // TEST 1: WRONG WORKER TOKEN
    // ==========================================

    const wrongTokenResult =
      await executeWebhookRecovery({
        eventId,
        processingToken: "incorrect-token",
      });

    assert.equal(wrongTokenResult.completed, false);

    const pendingOrder = await Order.findById(orderId);

    assert.equal(pendingOrder.paymentStatus, "Pending");

    console.log(
      "PASS: Incorrect worker token rejected"
    );

    // ==========================================
    // TEST 2: SUCCESSFUL RECOVERY
    // ==========================================

    const result = await executeWebhookRecovery({
      eventId,
      processingToken,
    });

    assert.equal(result.completed, true);
    assert.equal(result.paymentStatus, "Paid");

    const [
      paidOrder,
      completedAttempt,
      completedReservation,
      processedEvent,
    ] = await Promise.all([
      Order.findById(orderId),
      CheckoutAttempt.findOne({ order: orderId }),
      StockReservation.findOne({ order: orderId }),
      WebhookEvent.findOne({ eventId }),
    ]);

    assert.equal(paidOrder.paymentStatus, "Paid");
    assert.equal(paidOrder.orderStatus, "Confirmed");
    assert.equal(
      paidOrder.razorpayPaymentId,
      razorpayPaymentId
    );

    assert.equal(completedAttempt.status, "Completed");
    assert.equal(completedReservation.status, "Completed");
    assert.equal(processedEvent.status, "Processed");
    assert.equal(processedEvent.processingToken, null);

    console.log(
      "PASS: Full webhook recovery confirmed payment"
    );

    console.log(
      "PASS: All four MongoDB records updated"
    );

    // ==========================================
    // TEST 3: REPLAY SAME PROCESSED EVENT
    // ==========================================

    const replay = await executeWebhookRecovery({
      eventId,
      processingToken,
    });

    assert.equal(replay.completed, false);

    console.log(
      "PASS: Processed webhook cannot be replayed"
    );

    console.log(
      "All full webhook recovery integration tests passed!"
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

        console.log("Synthetic records cleaned up");
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
