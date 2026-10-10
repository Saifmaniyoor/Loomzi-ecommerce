
// Load environment variables FIRST
require("dotenv").config();
const express = require("express");
const adminRoutes = require("./routes/adminRoutes");

const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const app = express();

// ===============================
// 1. CORS Middleware
// ===============================
app.use(
  cors({
    origin: "http://localhost:5175",
    credentials: true,
  })
);

// ===============================
// 2. JSON Middleware
// ===============================
app.use(express.json());

// ===============================
// 3. MongoDB Connection
// ===============================
connectDB();

// ===============================
// 4. Session Configuration
// ===============================
app.use(
  session({
    name: "loomzi.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    // Store sessions in MongoDB
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),

    cookie: {
      httpOnly: true,

      // false for local HTTP development
      secure: false,

      sameSite: "lax",

      // Session expires after 24 hours
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ===============================
// 5. Admin Routes
// ===============================
app.use("/api/admin", adminRoutes);

// ===============================
// 6. API Routes
// ===============================
app.use("/api/auth", authRoutes);

// ===============================
// 7. Test Route
// ===============================
app.get("/", (req, res) => {
  res.send("Loomzi Backend API is running");
});

// ===============================
// 8. Start Server
// ===============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
