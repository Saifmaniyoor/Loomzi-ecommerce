
const Coupon = require("../models/Coupon");
const Cart = require("../models/Cart");

// Find coupon by code.
// Optionally use an existing MongoDB transaction session.
const findCouponByCode = async (code, session = null) => {
  const query = Coupon.findOne({ code });

  if (session) {
    query.session(session);
  }

  return query;
};

// Create coupon
const createCoupon = async (couponData) => {
  return Coupon.create(couponData);
};

// Find customer's cart
const findCartByUser = async (userId) => {
  return Cart.findOne({ user: userId })
    .populate("items.product");
};

module.exports = {
  findCouponByCode,
  createCoupon,
  findCartByUser,
};
