
const razorpay = require("../config/razorpay");

const RAZORPAY_CURRENCY = "INR";

const isValidRazorpayOrderId = (id) =>
  typeof id === "string" &&
  /^order_[a-zA-Z0-9]+$/.test(id);

const isValidRazorpayPaymentId = (id) =>
  typeof id === "string" &&
  /^pay_[a-zA-Z0-9]+$/.test(id);

const isValidReceipt = (receipt) =>
  typeof receipt === "string" &&
  receipt.length > 0 &&
  receipt.length <= 40;

// Create a Razorpay order.
//
// IMPORTANT:
// Razorpay order creation must not be blindly retried
// after a timeout or an uncertain API response.
//
// A receipt is a reference, not an idempotency key.
const createRazorpayOrder = async ({
  amount,
  receipt,
}) => {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 100
  ) {
    throw new Error("Invalid Razorpay amount");
  }

  if (!isValidReceipt(receipt)) {
    throw new Error("Invalid Razorpay receipt");
  }

  const order = await razorpay.orders.create({
    amount,
    currency: RAZORPAY_CURRENCY,
    receipt,
  });

  // Validate response before allowing the caller
  // to persist the Razorpay order ID.
  if (
    !order ||
    !isValidRazorpayOrderId(order.id) ||
    order.amount !== amount ||
    order.currency !== RAZORPAY_CURRENCY ||
    order.receipt !== receipt
  ) {
    throw new Error(
      "Unexpected Razorpay order creation response. Reconciliation required."
    );
  }

  return order;
};

// Retrieve an existing Razorpay order
const fetchRazorpayOrder = async (
  razorpayOrderId
) => {
  if (!isValidRazorpayOrderId(razorpayOrderId)) {
    throw new Error("Invalid Razorpay order ID");
  }

  const order = await razorpay.orders.fetch(
    razorpayOrderId
  );

  if (
    !order ||
    order.id !== razorpayOrderId
  ) {
    throw new Error(
      "Unexpected Razorpay order response"
    );
  }

  return order;
};

// Search Razorpay orders by receipt for
// controlled recovery investigation.
//
// IMPORTANT:
// This is a bounded search, not a guarantee
// of complete Razorpay order history.
//
// Do not use its results alone to authorize
// a new payment order, retry, or stock release.
const findRazorpayOrdersByReceipt = async (
  receipt
) => {
  if (!isValidReceipt(receipt)) {
    throw new Error("Invalid Razorpay receipt");
  }

  const PAGE_SIZE = 100;
  const MAX_PAGES = 10;

  const matches = [];
  let skip = 0;

  for (
    let page = 0;
    page < MAX_PAGES;
    page++
  ) {
    const response = await razorpay.orders.all({
      count: PAGE_SIZE,
      skip,
    });

    if (
      !response ||
      !Array.isArray(response.items) ||
      !Number.isSafeInteger(response.count)
    ) {
      throw new Error(
        "Invalid Razorpay order list response"
      );
    }

    const orders = response.items;

    for (const order of orders) {
      if (
        order &&
        order.receipt === receipt
      ) {
        matches.push(order);
      }
    }

    // A short page indicates the end of the
    // currently returned result set.
    if (orders.length < PAGE_SIZE) {
      return matches;
    }

    skip += orders.length;
  }

  // Never silently return partial search results
  // as though the entire history was checked.
  throw new Error(
    "Razorpay order search limit reached. Manual reconciliation required."
  );
};

// Retrieve payment activity for a Razorpay order.
//
// Do not interpret zero returned payments as
// permission to retry or release stock.
const fetchPaymentsForRazorpayOrder = async (
  razorpayOrderId
) => {
  if (!isValidRazorpayOrderId(razorpayOrderId)) {
    throw new Error("Invalid Razorpay order ID");
  }

  const response =
    await razorpay.orders.fetchPayments(
      razorpayOrderId
    );

  if (
    !response ||
    !Array.isArray(response.items) ||
    !Number.isSafeInteger(response.count) ||
    response.count < 0
  ) {
    throw new Error(
      "Invalid Razorpay payment list response"
    );
  }

  return response;
};

// Retrieve an individual Razorpay payment
const fetchRazorpayPayment = async (
  razorpayPaymentId
) => {
  if (!isValidRazorpayPaymentId(razorpayPaymentId)) {
    throw new Error("Invalid Razorpay payment ID");
  }

  const payment =
    await razorpay.payments.fetch(
      razorpayPaymentId
    );

  if (
    !payment ||
    payment.id !== razorpayPaymentId
  ) {
    throw new Error(
      "Unexpected Razorpay payment response"
    );
  }

  return payment;
};

module.exports = {
  createRazorpayOrder,
  fetchRazorpayOrder,
  findRazorpayOrdersByReceipt,
  fetchPaymentsForRazorpayOrder,
  fetchRazorpayPayment,
};
