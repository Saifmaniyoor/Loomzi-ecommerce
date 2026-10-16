
const {
  validateRazorpayWebhookPayload,
} = require("../utils/razorpayWebhookPayload");

const tests = [
  {
    name: "Valid captured payment",
    payload: {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_Test123",
            order_id: "order_Test123",
            amount: 50000,
            currency: "INR",
            status: "captured",
            captured: true,
          },
        },
      },
    },
    expected: true,
  },
  {
    name: "Captured payment with wrong status",
    payload: {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_Test123",
            order_id: "order_Test123",
            amount: 50000,
            currency: "INR",
            status: "authorized",
            captured: false,
          },
        },
      },
    },
    expected: false,
  },
  {
    name: "Payment with invalid currency",
    payload: {
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            id: "pay_Test123",
            order_id: "order_Test123",
            amount: 50000,
            currency: "USD",
            status: "failed",
          },
        },
      },
    },
    expected: false,
  },
  {
    name: "Valid paid order",
    payload: {
      event: "order.paid",
      payload: {
        order: {
          entity: {
            id: "order_Test123",
            amount: 50000,
            currency: "INR",
            status: "paid",
          },
        },
      },
    },
    expected: true,
  },
  {
    name: "Unsupported event",
    payload: {
      event: "loomzi.test",
    },
    expected: false,
  },
];

let passed = 0;

for (const test of tests) {
  const result = validateRazorpayWebhookPayload(
    test.payload
  );

  const success = result.valid === test.expected;

  console.log(
    `${success ? "PASS" : "FAIL"} - ${test.name}`
  );

  if (success) passed++;
}

console.log(
  `\nResults: ${passed}/${tests.length} passed`
);

if (passed !== tests.length) {
  process.exitCode = 1;
}
