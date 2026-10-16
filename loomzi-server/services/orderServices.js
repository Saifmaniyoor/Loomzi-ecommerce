
const Order = require("../models/Order");

// Create a new order

const createOrder = async (orderData, session = null) => {
  if (session) {
    const [order] = await Order.create(
      [orderData],
      { session }
    );

    return order;
  }

  return await Order.create(orderData);
};

// Find an order by ID
const findOrderById = async (orderId) => {
  return await Order.findById(orderId);
};

// Find an order belonging to a customer
const findUserOrderById = async (orderId, userId) => {
  return await Order.findOne({
    _id: orderId,
    user: userId,
  });
};

// Get all orders belonging to a customer
const findOrdersByUser = async (userId) => {
  return await Order.find({
    user: userId,
  }).sort({ createdAt: -1 });
};

// Find an order using Razorpay order ID
const findOrderByRazorpayOrderId = async (
  razorpayOrderId
) => {
  return await Order.findOne({
    razorpayOrderId,
  });
};

// Find an order using Razorpay payment ID
const findOrderByRazorpayPaymentId = async (
  razorpayPaymentId
) => {
  return await Order.findOne({
    razorpayPaymentId,
  });
};

// Update order details
const updateOrderById = async (orderId, updateData) => {
  return await Order.findByIdAndUpdate(
    orderId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  );
};

// Update order payment status
const updatePaymentStatus = async (
  orderId,
  paymentStatus,
  razorpayPaymentId = null
) => {
  const updateData = {
    paymentStatus,
  };

  if (razorpayPaymentId) {
    updateData.razorpayPaymentId = razorpayPaymentId;
  }

  return await Order.findByIdAndUpdate(
    orderId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
    }
  );
};


const attachRazorpayOrderId = async (
  orderId,
  razorpayOrderId
) => {
  return await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentStatus: "Pending",
      razorpayOrderId: null,
    },
    {
      $set: {
        razorpayOrderId,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );
};


const findOrderByIdAndUser = async ({
  orderId,
  userId,
}) => {
  return Order.findOne({
    _id: orderId,
    user: userId,
  });
};


module.exports = {
  createOrder,
  findOrderById,
  findUserOrderById,
  findOrdersByUser,
  findOrderByRazorpayOrderId,
  findOrderByRazorpayPaymentId,
  updateOrderById,
  updatePaymentStatus,
  attachRazorpayOrderId,
  findOrderByIdAndUser,
};
