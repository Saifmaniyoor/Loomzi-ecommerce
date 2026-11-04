
const checkoutAttemptServices = require(
  "../services/checkoutAttemptServices"
);

const addressServices = require(
  "../services/addressServices"
);

const couponServices = require(
  "../services/couponServices"
);

const Wallet = require("../models/Wallet");

const {
  calculateCartSummary,
} = require("../utils/cartCalculator");

const {
  normalizeCheckoutRequest,
  createRequestHash,
  validateIdempotencyKey,
} = require("../utils/checkoutRequest");

const {
  calculateCouponDiscount,
  calculateFinalAmount,
} = require("../utils/checkoutCalculation");

// =====================================================
// PAYMENT ALLOCATION
// =====================================================

const calculatePaymentAllocation = ({
  totalPaise,
  walletBalancePaise,
  useWallet,
}) => {
  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    throw new Error("Invalid checkout total");
  }

  if (
    !Number.isSafeInteger(walletBalancePaise) ||
    walletBalancePaise < 0
  ) {
    throw new Error("Invalid wallet balance");
  }

  if (!useWallet || walletBalancePaise === 0) {
    return {
      paymentMethod: "Razorpay",
      paymentBreakdown: {
        totalPaise,
        walletPaise: 0,
        razorpayPaise: totalPaise,
      },
    };
  }

  const walletPaise = Math.min(
    walletBalancePaise,
    totalPaise
  );

  const razorpayPaise =
    totalPaise - walletPaise;

  // Full wallet payment
  if (razorpayPaise === 0) {
    return {
      paymentMethod: "Wallet",
      paymentBreakdown: {
        totalPaise,
        walletPaise: totalPaise,
        razorpayPaise: 0,
      },
    };
  }

  // Razorpay contribution must be >= ₹1
  if (razorpayPaise < 100) {
    return {
      paymentMethod: "Wallet+Razorpay",
      paymentBreakdown: {
        totalPaise,
        walletPaise: totalPaise - 100,
        razorpayPaise: 100,
      },
    };
  }

  return {
    paymentMethod: "Wallet+Razorpay",
    paymentBreakdown: {
      totalPaise,
      walletPaise,
      razorpayPaise,
    },
  };
};

// =====================================================
// VALIDATE PAYMENT CHECKOUT
// =====================================================

// Read-only validation.
// Does not create an order or charge the customer.

const validatePaymentCheckout = async (
  req,
  res
) => {
  try {
    const userId = req.user._id;

    // 1. Validate idempotency key
    const idempotencyKey =
      validateIdempotencyKey(
        req.get("Idempotency-Key")
      );

    // 2. Normalize request
    const normalizedRequest =
      normalizeCheckoutRequest(
        req.body || {}
      );

    const requestHash =
      createRequestHash(normalizedRequest);

    // 3. Find prepared checkout attempt
    const attempt =
      await checkoutAttemptServices.findAttempt(
        userId,
        idempotencyKey
      );

    if (!attempt) {
      return res.status(404).json({
        message:
          "Checkout attempt not found. Prepare checkout first.",
      });
    }

    if (
      attempt.requestHash !== requestHash
    ) {
      return res.status(409).json({
        message:
          "Idempotency key was used with different checkout details",
      });
    }

    if (
      attempt.status !== "Processing"
    ) {
      return res.status(409).json({
        message:
          "Checkout attempt is not available for a new payment",
      });
    }

    if (attempt.order) {
      return res.status(409).json({
        message:
          "Checkout attempt is already linked to an order",
      });
    }

    // 4. Validate delivery address
    const address =
      await addressServices.findUserAddressById(
        normalizedRequest.addressId,
        userId
      );

    if (!address) {
      return res.status(404).json({
        message:
          "Delivery address not found",
      });
    }

    // 5. Recalculate cart
    const cartSummary =
      await calculateCartSummary(userId);

    if (
      !cartSummary.items ||
      cartSummary.items.length === 0
    ) {
      return res.status(400).json({
        message: "Your cart is empty",
      });
    }

    if (
      cartSummary.hasUnavailableItems
    ) {
      return res.status(409).json({
        message:
          "Some cart items are unavailable or out of stock",
      });
    }

    // 6. Validate coupon
    let coupon = null;
    let discount = 0;

    if (
      normalizedRequest.couponCode
    ) {
      coupon =
        await couponServices.findCouponByCode(
          normalizedRequest.couponCode
        );

      if (!coupon) {
        return res.status(400).json({
          message:
            "Invalid coupon code",
        });
      }

      discount =
        calculateCouponDiscount({
          subtotal:
            cartSummary.subtotal,
          coupon,
        });
    }

    // 7. Calculate final amount
    const paymentSummary =
      calculateFinalAmount({
        subtotal:
          cartSummary.subtotal,
        shippingCharge:
          cartSummary.shippingCharge,
        discount,
      });

    // 8. Convert total to paise
    //
    // Adjust "totalAmount" if your
    // calculateFinalAmount() returns
    // a different property name.
    const totalAmount =
      paymentSummary.totalAmount;

    const totalPaise =
      Math.round(totalAmount * 100);

    if (
      !Number.isSafeInteger(totalPaise) ||
      totalPaise < 100
    ) {
      throw new Error(
        "Invalid checkout total"
      );
    }

    // 9. Read wallet balance
    const useWallet =
      normalizedRequest.useWallet === true;

    let walletBalancePaise = 0;

    if (useWallet) {
      const wallet =
        await Wallet.findOne({
          user: userId,
        }).select("balancePaise");

      walletBalancePaise =
        wallet?.balancePaise ?? 0;
    }

    // 10. Calculate payment allocation
    const allocation =
      calculatePaymentAllocation({
        totalPaise,
        walletBalancePaise,
        useWallet,
      });

    // 11. Verify prepared payment method
    if (
      attempt.paymentMethod !==
      allocation.paymentMethod
    ) {
      return res.status(409).json({
        message:
          "Checkout payment method changed. Prepare a new checkout attempt.",
      });
    }

    // 12. Enforce coupon policy
    if (
      coupon?.code?.toUpperCase() ===
        "LOOMZI10" &&
      allocation.paymentMethod ===
        "Wallet"
    ) {
      return res.status(400).json({
        message:
          "LOOMZI10 requires Razorpay payment and cannot be used for wallet-only checkout",
      });
    }

    // 13. Return validated details
    return res.status(200).json({
      message:
        "Payment checkout validated",

      attemptId: attempt._id,

      paymentMethod:
        allocation.paymentMethod,

      paymentBreakdown:
        allocation.paymentBreakdown,

      address: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1:
          address.addressLine1,
        addressLine2:
          address.addressLine2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },

      items: cartSummary.items,

      coupon: coupon
        ? {
            code: coupon.code,
            discountAmount: discount,
          }
        : null,

      paymentSummary,

      wallet: {
        balancePaise:
          walletBalancePaise,
        availableBalance:
          walletBalancePaise / 100,
      },

      nextStep:
        "CREATE_PENDING_ORDER",
    });
  } catch (error) {
    const message =
      error?.message || "";

    const validationMessages = [
      "Valid Idempotency-Key header is required",
      "Valid delivery address is required",
      "Invalid coupon code",
      "Coupon is inactive",
      "Coupon has expired",
      "Invalid payment amount",
      "Invalid checkout total",
      "Invalid wallet balance",
    ];

    if (
      validationMessages.includes(message) ||
      message.startsWith(
        "Minimum purchase of"
      )
    ) {
      return res.status(400).json({
        message,
      });
    }

    console.error(
      "Validate payment checkout error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to validate payment checkout",
    });
  }
};

module.exports = {
  validatePaymentCheckout,
};
