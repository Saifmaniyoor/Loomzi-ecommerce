
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const Order = require("../models/Order");
const CheckoutAttempt = require("../models/CheckoutAttempt");
const StockReservation = require("../models/StockReservation");
const WebhookEvent = require("../models/WebhookEvent");

const {
  confirmCapturedPaymentTransaction,
} = require("../services/paymentConfirmationTransactionServices");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runTest = async () => {
  const suffix = crypto.randomBytes(12).toString("hex");

  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  const razorpayOrderId = `order_${suffix}`;
  const razorpayPaymentId = `pay_${suffix}`;

  const eventId = `loomzi-atomic-test-${suffix}`;
  const correctToken = crypto.randomUUID();

  const secondEventId = `loomzi-duplicate-test-${suffix}`;
  const secondToken = crypto.randomUUID();

  let orderId = null;
  let connected = false;

  try {
    // ==========================================
    // 1. CONNECT TO MONGODB
    // ==========================================

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    await mongoose.connect(process.env.MONGO_URI);
    connected = true;

    console.log("MongoDB connected");

    // ==========================================
    // 2. CREATE SYNTHETIC ORDER
    // ==========================================

    const order = await Order.create({
      user: userId,
      items: [
        {
          product: productId,
          name: "Webhook Test Product",
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

    // ==========================================
    // 3. CREATE CHECKOUT ATTEMPT
    // ==========================================

    await CheckoutAttempt.create({
      user: userId,
      idempotencyKey: `atomic-test-${suffix}`,
      requestHash: suffix,
      order: orderId,
      razorpayOrderId,
      status: "Ready",
      amountInPaise: 55000,
      currency: "INR",
    });

    // ==========================================
    // 4. CREATE STOCK RESERVATION
    // ==========================================

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

    // ==========================================
    // 5. CREATE FIRST SYNTHETIC WEBHOOK
    // ==========================================

    const webhookPayload = {
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
    };

    await WebhookEvent.create({
      eventId,
      eventType: "payment.captured",
      payload: webhookPayload,
      status: "Processing",
      processingToken: correctToken,
      processingStartedAt: new Date(),
    });

    console.log("Synthetic test records created");

    const paymentDetails = {
      userId,
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
    };

    // ==========================================
    // TEST 1: INCORRECT TOKEN MUST FAIL
    // ==========================================

    let incorrectTokenRejected = false;

    try {
      await confirmCapturedPaymentTransaction({
        ...paymentDetails,
        webhookContext: {
          eventId,
          processingToken: "incorrect-token",
        },
      });
    } catch (error) {
      incorrectTokenRejected = true;
    }

    assert(
      incorrectTokenRejected,
      "Incorrect processing token was accepted"
    );

    const orderAfterFailure =
      await Order.findById(orderId);

    const attemptAfterFailure =
      await CheckoutAttempt.findOne({
        order: orderId,
      });

    const reservationAfterFailure =
      await StockReservation.findOne({
        order: orderId,
      });

    const eventAfterFailure =
      await WebhookEvent.findOne({ eventId });

    assert(
      orderAfterFailure.paymentStatus === "Pending" &&
        orderAfterFailure.razorpayPaymentId == null,
      "Order changed after incorrect token"
    );

    assert(
      attemptAfterFailure.status === "Ready",
      "Checkout attempt changed after incorrect token"
    );

    assert(
      reservationAfterFailure.status === "Active" &&
        reservationAfterFailure.completedAt == null,
      "Stock reservation changed after incorrect token"
    );

    assert(
      eventAfterFailure.status === "Processing" &&
        eventAfterFailure.processingToken === correctToken,
      "Webhook changed after incorrect token"
    );

    console.log(
      "PASS: Incorrect token rejected without database changes"
    );

    // ==========================================
    // TEST 2: PAYMENT ID MISMATCH MUST FAIL
    // ==========================================

    const mismatchedPaymentId =
      `pay_${crypto.randomBytes(12).toString("hex")}`;

    let mismatchRejected = false;

    try {
      await confirmCapturedPaymentTransaction({
        ...paymentDetails,
        razorpayPaymentId: mismatchedPaymentId,
        webhookContext: {
          eventId,
          processingToken: correctToken,
        },
      });
    } catch (error) {
      mismatchRejected = true;
    }

    assert(
      mismatchRejected,
      "SECURITY TEST FAILED: Mismatched payment accepted"
    );

    const orderAfterMismatch =
      await Order.findById(orderId);

    const attemptAfterMismatch =
      await CheckoutAttempt.findOne({
        order: orderId,
      });

    const reservationAfterMismatch =
      await StockReservation.findOne({
        order: orderId,
      });

    const eventAfterMismatch =
      await WebhookEvent.findOne({ eventId });

    assert(
      orderAfterMismatch.paymentStatus === "Pending" &&
        orderAfterMismatch.razorpayPaymentId == null,
      "Order changed after payment mismatch"
    );

    assert(
      attemptAfterMismatch.status === "Ready",
      "Checkout attempt changed after payment mismatch"
    );

    assert(
      reservationAfterMismatch.status === "Active" &&
        reservationAfterMismatch.completedAt == null,
      "Reservation changed after payment mismatch"
    );

    assert(
      eventAfterMismatch.status === "Processing" &&
        eventAfterMismatch.processingToken === correctToken,
      "Webhook changed after payment mismatch"
    );

    console.log(
      "PASS: Mismatched payment ID rejected without changes"
    );

    // ==========================================
    // TEST 3: VALID PAYMENT CONFIRMATION
    // ==========================================

    // Direct database transaction test only.
    // Synthetic Razorpay IDs are used.
    // No real payment is created or verified.

    const confirmation =
      await confirmCapturedPaymentTransaction({
        ...paymentDetails,
        webhookContext: {
          eventId,
          processingToken: correctToken,
        },
      });

    assert(
      confirmation.paymentStatus === "Paid" &&
        confirmation.alreadyConfirmed === false,
      "Valid confirmation did not succeed"
    );

    const paidOrder = await Order.findById(orderId);

    const completedAttempt =
      await CheckoutAttempt.findOne({
        order: orderId,
      });

    const completedReservation =
      await StockReservation.findOne({
        order: orderId,
      });

    const processedEvent =
      await WebhookEvent.findOne({ eventId });

    assert(
      paidOrder.paymentStatus === "Paid" &&
        paidOrder.orderStatus === "Confirmed" &&
        paidOrder.razorpayPaymentId === razorpayPaymentId,
      "Order was not confirmed correctly"
    );

    assert(
      completedAttempt.status === "Completed",
      "Checkout attempt was not completed"
    );

    assert(
      completedReservation.status === "Completed" &&
        completedReservation.completedAt != null,
      "Stock reservation was not completed"
    );

    assert(
      processedEvent.status === "Processed" &&
        processedEvent.processingToken == null &&
        processedEvent.processedAt != null,
      "Webhook event was not completed"
    );

    console.log(
      "PASS: Order, checkout, reservation and webhook completed together"
    );

    // ==========================================
    // TEST 4: DUPLICATE CONFIRMATION
    // ==========================================

    const duplicateResult =
      await confirmCapturedPaymentTransaction({
        ...paymentDetails,
      });

    assert(
      duplicateResult.alreadyConfirmed === true &&
        duplicateResult.paymentStatus === "Paid",
      "Duplicate confirmation was not idempotent"
    );

    console.log(
      "PASS: Duplicate payment confirmation is idempotent"
    );

    // ==========================================
    // TEST 5: SECOND WEBHOOK FOR ALREADY-PAID ORDER
    // ==========================================

    // Simulate Razorpay delivering another
    // webhook for the same captured payment.

    await WebhookEvent.create({
      eventId: secondEventId,
      eventType: "payment.captured",
      payload: webhookPayload,
      status: "Processing",
      processingToken: secondToken,
      processingStartedAt: new Date(),
    });

    // ==========================================
    // TEST 5A: WRONG PAYMENT ID MUST FAIL
    // ==========================================

    const wrongPaymentId =
      `pay_${crypto.randomBytes(12).toString("hex")}`;

    let wrongPaymentRejected = false;

    try {
      await confirmCapturedPaymentTransaction({
        ...paymentDetails,
        razorpayPaymentId: wrongPaymentId,
        webhookContext: {
          eventId: secondEventId,
          processingToken: secondToken,
        },
      });
    } catch (error) {
      wrongPaymentRejected = true;
    }

    assert(
      wrongPaymentRejected,
      "Different payment ID accepted for already-paid order"
    );

    const eventAfterRejection =
      await WebhookEvent.findOne({
        eventId: secondEventId,
      });

    const orderAfterRejection =
      await Order.findById(orderId);

    assert(
      eventAfterRejection.status === "Processing" &&
        eventAfterRejection.processingToken === secondToken,
      "Second webhook changed after payment mismatch"
    );

    assert(
      orderAfterRejection.paymentStatus === "Paid" &&
        orderAfterRejection.razorpayPaymentId === razorpayPaymentId,
      "Paid order changed after mismatched payment"
    );

    console.log(
      "PASS: Different payment rejected for already-paid order"
    );

    // ==========================================
    // TEST 5B: SAME PAYMENT MUST SUCCEED
    // ==========================================

    const secondConfirmation =
      await confirmCapturedPaymentTransaction({
        ...paymentDetails,
        webhookContext: {
          eventId: secondEventId,
          processingToken: secondToken,
        },
      });

    assert(
      secondConfirmation.alreadyConfirmed === true &&
        secondConfirmation.paymentStatus === "Paid",
      "Already-paid confirmation was not idempotent"
    );

    const finalOrder = await Order.findById(orderId);

    const finalAttempt =
      await CheckoutAttempt.findOne({
        order: orderId,
      });

    const finalReservation =
      await StockReservation.findOne({
        order: orderId,
      });

    const finalEvent =
      await WebhookEvent.findOne({
        eventId: secondEventId,
      });

    assert(
      finalOrder.paymentStatus === "Paid" &&
        finalOrder.orderStatus === "Confirmed" &&
        finalOrder.razorpayPaymentId === razorpayPaymentId,
      "Already-paid order changed incorrectly"
    );

    assert(
      finalAttempt.status === "Completed",
      "Checkout attempt changed unexpectedly"
    );

    assert(
      finalReservation.status === "Completed" &&
        finalReservation.completedAt != null,
      "Stock reservation changed unexpectedly"
    );

    assert(
      finalEvent.status === "Processed" &&
        finalEvent.processingToken == null &&
        finalEvent.processedAt != null,
      "Second webhook was not processed"
    );

    console.log(
      "PASS: Already-paid order handled with second webhook"
    );

    // ==========================================
    // ALL TESTS COMPLETED
    // ==========================================

    console.log(
      "All atomic webhook confirmation tests passed!"
    );
  } catch (error) {
    console.error("TEST FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    // ==========================================
    // CLEAN UP SYNTHETIC TEST RECORDS ONLY
    // ==========================================

    if (connected) {
      try {
        await WebhookEvent.deleteMany({
          eventId: {
            $in: [eventId, secondEventId],
          },
        });

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
