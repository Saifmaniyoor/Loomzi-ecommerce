
require("dotenv").config();

const mongoose = require("mongoose");

const {
  releaseExpiredUnpaidCheckout,
} = require("../services/reservationTransactionServices");

const ORDER_ID = "6ad0ce11433befca60f5dbaa";
const USER_ID = "6ace520804a2fc7dbeefef22";

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    const result = await releaseExpiredUnpaidCheckout({
      orderId: ORDER_ID,
      userId: USER_ID,
    });

    console.log("Cleanup result:", result);
  } catch (error) {
    console.error("Cleanup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
