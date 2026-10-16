
const assert = require("node:assert/strict");

const {
  calculateCouponDiscount,
  calculateFinalAmount,
} = require("../utils/checkoutCalculation");

// LOOMZI10 coupon test data
const coupon = {
  code: "LOOMZI10",
  isActive: true,
  expiresAt: new Date("2027-12-31"),
  minimumPurchase: 500,
  discountValue: 10,
  maximumDiscount: 100,
};

// Test 1: Minimum purchase
assert.throws(
  () =>
    calculateCouponDiscount({
      subtotal: 400,
      coupon,
    }),
  /Minimum purchase/
);
console.log("PASS: Minimum purchase validation");

// Test 2: Normal 10% discount
const discount1 = calculateCouponDiscount({
  subtotal: 600,
  coupon,
});

assert.equal(discount1, 60);
console.log("PASS: 10% coupon discount");

// Test 3: Maximum discount ₹100
const discount2 = calculateCouponDiscount({
  subtotal: 2000,
  coupon,
});

assert.equal(discount2, 100);
console.log("PASS: Maximum discount limit");

// Test 4: Expired coupon
assert.throws(
  () =>
    calculateCouponDiscount({
      subtotal: 1000,
      coupon: {
        ...coupon,
        expiresAt: new Date("2025-01-01"),
      },
    }),
  /expired/
);
console.log("PASS: Expired coupon rejected");

// Test 5: Final payment amount
const payment = calculateFinalAmount({
  subtotal: 1000,
  shippingCharge: 50,
  discount: 100,
});

assert.equal(payment.totalAmount, 950);
assert.equal(payment.amountInPaise, 95000);
assert.equal(payment.currency, "INR");

console.log("PASS: Final payment amount");
console.log("PASS: INR to paise conversion");

// Test 6: Negative discount
assert.throws(
  () =>
    calculateFinalAmount({
      subtotal: 1000,
      shippingCharge: 50,
      discount: -100,
    }),
  /Invalid checkout amount/
);
console.log("PASS: Negative discount rejected");

// Test 7: Discount greater than subtotal
assert.throws(
  () =>
    calculateFinalAmount({
      subtotal: 500,
      shippingCharge: 50,
      discount: 600,
    }),
  /Discount cannot exceed subtotal/
);
console.log("PASS: Excessive discount rejected");

// Test 8: Invalid payment amount
assert.throws(
  () =>
    calculateFinalAmount({
      subtotal: 0,
      shippingCharge: 0,
      discount: 0,
    }),
  /Invalid payment amount/
);
console.log("PASS: Invalid payment amount rejected");

console.log("\nAll checkout calculation tests passed!");
