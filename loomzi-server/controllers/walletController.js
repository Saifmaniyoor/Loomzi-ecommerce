
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/User");
const mongoose = require("mongoose");

// ======================================
// GET CURRENT USER WALLET
// ======================================

const getMyWallet = async (req, res) => {
  try {
    const user = req.user._id;

    const [wallet, transactions] = await Promise.all([
      Wallet.findOne({ user }).lean(),

      WalletTransaction.find({ user })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    // Wallet balance is stored in paise.
    const balancePaise = wallet?.balancePaise ?? 0;

    return res.json({
      // Existing field - amount in rupees
      balance: balancePaise / 100,

      // New field - amount in paise
      // Used by Checkout.jsx
      balancePaise,

      currency: "INR",

      transactions: transactions.map((t) => ({
        id: t._id,
        orderId: t.order,
        type: t.kind,
        amount: t.amountPaise / 100,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("Wallet lookup failed:", error);

    return res.status(500).json({
      message:
        "Unable to load your wallet. Please try again.",
    });
  }
};

// ======================================
// GET CUSTOMER WALLET - ADMIN
// ======================================

const getAdminWallet = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid customer ID.",
      });
    }

    const user = await User.findById(userId)
      .select("fullName email")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    const [wallet, transactions] = await Promise.all([
      Wallet.findOne({
        user: user._id,
      }).lean(),

      WalletTransaction.find({
        user: user._id,
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const balancePaise = wallet?.balancePaise ?? 0;

    return res.json({
      user,

      balance: balancePaise / 100,
      balancePaise,

      currency: "INR",

      // Preserve existing admin transaction format.
      transactions,
    });
  } catch (error) {
    console.error("Admin wallet lookup failed:", error);

    return res.status(500).json({
      message: "Unable to load customer wallet.",
    });
  }
};

// ======================================
// EXPORT CONTROLLERS
// ======================================

module.exports = {
  getMyWallet,
  getAdminWallet,
};
