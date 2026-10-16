
const roundAmount = (amount) => {
  return Math.round(
    (amount + Number.EPSILON) * 100
  ) / 100;
};

const isValidAmount = (amount) => {
  return (
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount >= 0
  );
};

// Calculate coupon discount
const calculateCouponDiscount = ({
  subtotal,
  coupon,
}) => {
  if (!isValidAmount(subtotal)) {
    throw new Error("Invalid cart subtotal");
  }

  if (!coupon) {
    return 0;
  }

  const now = new Date();

  if (!coupon.isActive) {
    throw new Error("Coupon is inactive");
  }

  if (
    !coupon.expiresAt ||
    !Number.isFinite(
      new Date(coupon.expiresAt).getTime()
    ) ||
    new Date(coupon.expiresAt) <= now
  ) {
    throw new Error("Coupon has expired");
  }

  const minimumPurchase = Number(
    coupon.minimumPurchase
  );

  const discountValue = Number(
    coupon.discountValue
  );

  const maximumDiscount = Number(
    coupon.maximumDiscount
  );

  if (
    !isValidAmount(minimumPurchase) ||
    !isValidAmount(discountValue) ||
    discountValue > 100 ||
    !isValidAmount(maximumDiscount)
  ) {
    throw new Error("Invalid coupon configuration");
  }

  if (subtotal < minimumPurchase) {
    throw new Error(
      `Minimum purchase of ₹${minimumPurchase} required`
    );
  }

  const percentageDiscount =
    (subtotal * discountValue) / 100;

  return roundAmount(
    Math.min(
      percentageDiscount,
      maximumDiscount,
      subtotal
    )
  );
};

// Calculate final Razorpay payment amount
const calculateFinalAmount = ({
  subtotal,
  shippingCharge,
  discount,
}) => {
  if (
    !isValidAmount(subtotal) ||
    !isValidAmount(shippingCharge) ||
    !isValidAmount(discount)
  ) {
    throw new Error("Invalid checkout amount");
  }

  if (discount > subtotal) {
    throw new Error(
      "Discount cannot exceed subtotal"
    );
  }

  const totalAmount = roundAmount(
    subtotal - discount + shippingCharge
  );

  if (
    !Number.isFinite(totalAmount) ||
    totalAmount < 1
  ) {
    throw new Error("Invalid payment amount");
  }

  const amountInPaise = Math.round(
    totalAmount * 100
  );

  if (!Number.isSafeInteger(amountInPaise)) {
    throw new Error("Invalid payment amount");
  }

  return {
    subtotal: roundAmount(subtotal),
    discount: roundAmount(discount),
    shippingCharge: roundAmount(shippingCharge),
    tax: 0,
    totalAmount,
    amountInPaise,
    currency: "INR",
  };
};

module.exports = {
  calculateCouponDiscount,
  calculateFinalAmount,
};
