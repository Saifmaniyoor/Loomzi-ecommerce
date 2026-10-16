
require("dotenv").config();

const crypto = require("node:crypto");

const payload = {
  event: "payment.captured",
  payload: {
    payment: {
      entity: {
        id: "pay_LoomziTest001",
        order_id: "order_LoomziTest001",
        amount: 50000,
        currency: "INR",
        status: "captured",
        captured: true,
      },
    },
  },
};

const body = JSON.stringify(payload);

const signature = crypto
  .createHmac(
    "sha256",
    process.env.RAZORPAY_WEBHOOK_SECRET
  )
  .update(body)
  .digest("hex");

console.log("Body:", body);
console.log("Signature:", signature);
console.log("Event ID: loomzi-payload-test-001");
