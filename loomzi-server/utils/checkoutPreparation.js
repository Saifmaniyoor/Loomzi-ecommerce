
const addressServices = require(
  "../services/addressServices"
);

const couponServices = require(
  "../services/couponServices"
);

const {
  calculateCartSummary,
} = require("./cartCalculator");

const {
  calculateCouponDiscount,
  calculateFinalAmount,
} = require("./checkoutCalculation");

const {
  createCartSnapshotHash,
} = require("./checkoutSnapshot");

// Prepare checkout using backend data only.
const prepareOrderData = async ({
  userId,
  addressId,
  couponCode = "",
}) => {
  // 1. Verify delivery address belongs to customer
  const address =
    await addressServices.findUserAddressById(
      addressId,
      userId
    );

  if (!address) {
    throw new Error("Delivery address not found");
  }

  // 2. Calculate cart from MongoDB
  const cartSummary =
    await calculateCartSummary(userId);

  if (
    !cartSummary.items ||
    cartSummary.items.length === 0
  ) {
    throw new Error("Your cart is empty");
  }

  if (cartSummary.hasUnavailableItems) {
    throw new Error(
      "Some cart items are unavailable or out of stock"
    );
  }

  // 3. Validate coupon
  let coupon = null;
  let discount = 0;

  if (couponCode) {
    coupon =
      await couponServices.findCouponByCode(
        couponCode
      );

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    discount = calculateCouponDiscount({
      subtotal: cartSummary.subtotal,
      coupon,
    });
  }

  // 4. Calculate final payment amount
  const paymentSummary = calculateFinalAmount({
    subtotal: cartSummary.subtotal,
    shippingCharge: cartSummary.shippingCharge,
    discount,
  });

  // 5. Prepare address snapshot
  const shippingAddress = {
    fullName: address.fullName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || "",
    landmark: address.landmark || "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };

  // 6. Prepare coupon snapshot
  const couponSnapshot = coupon
    ? {
        code: coupon.code,
        discountAmount: discount,
      }
    : {
        code: null,
        discountAmount: 0,
      };

  // 7. Generate cart snapshot hash
  const cartSnapshotHash =
    createCartSnapshotHash({
      items: cartSummary.items,
      addressId,
      couponCode,
      subtotal: paymentSummary.subtotal,
      discount: paymentSummary.discount,
      shippingCharge: paymentSummary.shippingCharge,
      totalAmount: paymentSummary.totalAmount,
    });

  return {
    items: cartSummary.items,
    shippingAddress,
    subtotal: paymentSummary.subtotal,
    coupon: couponSnapshot,
    shippingCharge: paymentSummary.shippingCharge,
    totalAmount: paymentSummary.totalAmount,
    cartSnapshotHash,
    amountInPaise: paymentSummary.amountInPaise,
    currency: paymentSummary.currency,
  };
};

module.exports = {
  prepareOrderData,
};
