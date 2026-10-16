
const mongoose = require("mongoose");

const {
  confirmRazorpayPayment,
} = require("../services/paymentConfirmationServices");

const confirmPayment = async (req, res) => {
  try {
    const userId = req.user?._id;

    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login to continue",
      });
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Loomzi order ID",
      });
    }

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment details",
      });
    }

    const result = await confirmRazorpayPayment({
      userId,
      orderId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!result.success) {
      return res.status(409).json({
        success: false,
        message: result.reason,
        paymentStatus: result.paymentStatus,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.alreadyConfirmed
        ? "Payment was already confirmed"
        : "Payment confirmed successfully",
      data: {
        orderId: result.orderId,
        paymentStatus: result.paymentStatus,
        orderStatus: result.orderStatus,
        alreadyConfirmed: result.alreadyConfirmed,
      },
    });
  } catch (error) {
    console.error(
      "Payment confirmation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Payment confirmation could not be completed. Please check your order status before retrying.",
    });
  }
};

module.exports = {
  confirmPayment,
};
