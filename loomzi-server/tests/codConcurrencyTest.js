
const crypto = require("node:crypto");

const API_URL = "http://localhost:5000/api/checkout/cod";

const addressId = process.env.TEST_ADDRESS_ID;
const sessionCookie = process.env.TEST_SESSION_COOKIE;

if (!addressId || !sessionCookie) {
  console.error(
    "TEST_ADDRESS_ID and TEST_SESSION_COOKIE are required."
  );
  process.exit(1);
}

const sendCheckout = async (key) => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        Cookie: `loomzi.sid=${sessionCookie}`,
      },
      body: JSON.stringify({
        addressId,
        couponCode: "",
      }),
    });

    return {
      status: response.status,
      body: await response.json(),
    };
  } catch (error) {
    return {
      status: "NETWORK_ERROR",
      body: { message: error.message },
    };
  }
};

const runTest = async () => {
  const testId = crypto.randomUUID().replace(/-/g, "");

  const [first, second] = await Promise.all([
    sendCheckout(`cod-concurrent-a-${testId}`),
    sendCheckout(`cod-concurrent-b-${testId}`),
  ]);

  console.log("Request A:", JSON.stringify(first, null, 2));
  console.log("Request B:", JSON.stringify(second, null, 2));

  const successful = [first, second].filter(
    (result) => result.status === 201
  );

  console.log("New orders created:", successful.length);

  if (successful.length === 1) {
    console.log(
      "Initial result passed. Verify orders and stock in MongoDB."
    );
  } else {
    console.log(
      "Unexpected result. Inspect the database before retrying."
    );
  }
};

runTest();
