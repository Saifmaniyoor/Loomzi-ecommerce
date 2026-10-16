
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;

    // Check MongoDB connection string
    if (!mongoUri) {
      throw new Error("MONGO_URI is missing");
    }

    // Connect to existing MongoDB database
    await mongoose.connect(mongoUri);

    console.log(
      `MongoDB connected successfully: ${mongoose.connection.name}`
    );

  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
};

module.exports = connectDB;
