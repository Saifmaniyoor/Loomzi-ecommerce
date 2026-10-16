
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  createPendingOrderWithReservation,
} = require("../services/orderTransactionServices");

const validData = {
  attemptId: new mongoose.Types.ObjectId(),
  userId: new mongoose.Types.ObjectId(),

  items: [
    {
      productId: new mongoose.Types.ObjectId(),
      name: "Kids Dress",
      price: 500,
      quantity: 2,
      lineTotal: 1000,
      variantId: null,
    },
  ],

  shippingAddress: {
    fullName: "Test Customer",
    phone: "9876543210",
    addressLine1: "Test Address",
    city: "Kannur",
    state: "Kerala",
    pincode: "670001",
  },

  subtotal: 1000,

  coupon: {
    code: "LOOMZI10",
    discountAmount: 100,
  },

  shippingCharge: 50,
  totalAmount: 950,
  amountInPaise: 95000,
  cartSnapshotHash: "a".repeat(64),
};

const runTests = async () => {
  // Test 1: Invalid subtotal
  await assert.rejects(
    createPendingOrderWithReservation({
      ...validData,
      subtotal: 900,
    }),
    /Order subtotal mismatch/
  );

  console.log("PASS: Incorrect subtotal rejected");

  // Test 2: Invalid final amount
  await assert.rejects(
    createPendingOrderWithReservation({
      ...validData,
      totalAmount: 850,
      amountInPaise: 85000,
    }),
    /Checkout payment amount mismatch/
  );

  console.log("PASS: Incorrect final amount rejected");

  // Test 3: Invalid line total
  await assert.rejects(
    createPendingOrderWithReservation({
      ...validData,
      items: [
        {
          ...validData.items[0],
          lineTotal: 800,
        },
      ],
    }),
    /Invalid order item amount/
  );

  console.log("PASS: Incorrect item total rejected");

  console.log(
    "\nAll checkout amount rejection tests passed!"
  );
};

runTests().catch((error) => {
  console.error("Test failed:", error);
  process.exitCode = 1;
});
