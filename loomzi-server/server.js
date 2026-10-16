
 // ======================================
 // Load Environment Variables FIRST
 // ======================================
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

// ======================================
// Database Configuration
// ======================================
const connectDB = require("./config/db");

// ======================================
// Admin Routes
// ======================================
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const imageRoutes = require("./routes/imageRoutes");

const shippingSettingsRoutes = require(
  "./routes/shippingSettingsRoutes"
);

// ======================================
// User Routes
// ======================================
const authRoutes = require("./routes/authRoutes");

const customerProductRoutes = require(
  "./routes/customerProductRoutes"
);

const cartRoutes = require("./routes/cartRoutes");
const profileRoutes = require("./routes/profileRoutes");
const addressRoutes = require("./routes/addressRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");

// ======================================
// Checkout and Payment Routes
// ======================================
const couponRoutes = require("./routes/couponRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");

const paymentConfirmationRoutes = require(
  "./routes/paymentConfirmationRoutes"
);

// ======================================
// Razorpay Webhook Controller
// ======================================
const {
  receiveRazorpayWebhook,
} = require("./controllers/razorpayWebhookController");

// ======================================
// Initialize Express
// ======================================
const app = express();

// ======================================
// 1. CORS Middleware
// ======================================
app.use(
  cors({
    origin: "http://localhost:5174",
    credentials: true,
  })
);

// ======================================
// 2. Razorpay Webhook
// IMPORTANT: Must be BEFORE express.json()
// ======================================

// Verifies webhook signatures and
// registers events in MongoDB.
//
// Payment processing is NOT enabled yet.
app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "256kb",
  }),
  receiveRazorpayWebhook
);

// ======================================
// 3. JSON Middleware
// ======================================
app.use(express.json());

// ======================================
// 4. MongoDB Connection
// ======================================
connectDB();

// ======================================
// 5. Session Configuration
// ======================================
app.use(
  session({
    name: "loomzi.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,
    saveUninitialized: false,

    // MongoDB Session Store
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),

    cookie: {
      httpOnly: true,

      // Local HTTP development
      secure: false,

      sameSite: "lax",

      // Session expires after 24 hours
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ======================================
// 6. Admin Routes
// ======================================
app.use("/api/admin", adminRoutes);

app.use(
  "/api/admin/settings/shipping",
  shippingSettingsRoutes
);

app.use(
  "/api/admin/categories",
  categoryRoutes
);

app.use(
  "/api/admin/products",
  productRoutes
);

app.use(
  "/api/admin/images",
  imageRoutes
);

// ======================================
// 7. User Routes
// ======================================
app.use("/api/auth", authRoutes);

app.use(
  "/api/products",
  customerProductRoutes
);

app.use("/api/cart", cartRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/wishlist", wishlistRoutes);

// ======================================
// 8. Coupon and Checkout Routes
// ======================================
app.use("/api/coupons", couponRoutes);

app.use(
  "/api/checkout",
  checkoutRoutes
);

// ======================================
// 9. Payment Routes
// ======================================
app.use(
  "/api/payments",
  paymentConfirmationRoutes
);

// ======================================
// 10. Test Route
// ======================================
app.get("/", (req, res) => {
  res.send("Loomzi Backend API is running");
});

// ======================================
// 11. Start Server
// ======================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
