
const mongoose = require("mongoose");

const Product = require("../models/Product");
const CheckoutAttempt = require("../models/CheckoutAttempt");

const {
  calculateFinalAmount,
} = require("../utils/checkoutCalculation");

const orderServices = require("./orderServices");
const inventoryServices = require("./inventoryServices");

const categoryReservationServices = require(
  "./categoryReservationServices"
);

const stockReservationServices = require(
  "./stockReservationServices"
);

const checkoutAttemptServices = require(
  "./checkoutAttemptServices"
);

const {
  reserveForPurchase,
} = require("./walletLedgerService");

const {
  validateCouponForCheckout,
} = require("./couponValidationServices");

const {
  validateShippingForCheckout,
} = require("./shippingValidationServices");

// =====================================================
// HELPERS
// =====================================================

function validatePaymentBreakdown({
  paymentMethod,
  paymentBreakdown,
  totalPaise,
}) {
  if (
    ![
      "Razorpay",
      "Wallet",
      "Wallet+Razorpay",
    ].includes(paymentMethod)
  ) {
    throw new Error("Unsupported checkout payment method");
  }

  if (
    !paymentBreakdown ||
    !Number.isSafeInteger(paymentBreakdown.totalPaise) ||
    !Number.isSafeInteger(paymentBreakdown.walletPaise) ||
    !Number.isSafeInteger(paymentBreakdown.razorpayPaise)
  ) {
    throw new Error("Invalid payment breakdown");
  }

  const {
    totalPaise: breakdownTotal,
    walletPaise,
    razorpayPaise,
  } = paymentBreakdown;

  if (
    breakdownTotal !== totalPaise ||
    walletPaise < 0 ||
    razorpayPaise < 0 ||
    walletPaise + razorpayPaise !== totalPaise
  ) {
    throw new Error("Payment breakdown total mismatch");
  }

  if (
    paymentMethod === "Razorpay" &&
    (walletPaise !== 0 || razorpayPaise !== totalPaise)
  ) {
    throw new Error("Invalid Razorpay payment allocation");
  }

  if (
    paymentMethod === "Wallet" &&
    (walletPaise !== totalPaise || razorpayPaise !== 0)
  ) {
    throw new Error("Invalid wallet payment allocation");
  }

  if (
    paymentMethod === "Wallet+Razorpay" &&
    (walletPaise <= 0 || razorpayPaise < 100)
  ) {
    throw new Error("Invalid split payment allocation");
  }
}

// =====================================================
// CREATE PENDING ORDER AND RESERVE FUNDS + STOCK
// =====================================================

const createPendingOrderWithReservation = async ({
  attemptId,
  userId,
  items,
  shippingAddress,
  subtotal,
  coupon,
  shippingCharge,
  totalAmount,
  cartSnapshotHash,
  amountInPaise,

  // New arguments, provided by checkout orchestration.
  paymentMethod = "Razorpay",
  paymentBreakdown = null,
}) => {
  // 1. Validate IDs
  if (
    !mongoose.isValidObjectId(attemptId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new Error("Invalid checkout attempt or user ID");
  }

  // 2. Validate order items
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain items");
  }

  // 3. Validate cart snapshot hash
  if (
    typeof cartSnapshotHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(cartSnapshotHash)
  ) {
    throw new Error("Invalid cart snapshot hash");
  }

  // 4. Validate complete order amount
  if (
    typeof totalAmount !== "number" ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0 ||
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100 ||
    Math.round(totalAmount * 100) !== amountInPaise
  ) {
    throw new Error("Invalid checkout amount");
  }

  // 5. Calculate and validate subtotal
  const calculatedSubtotal = Math.round(
    items.reduce((sum, item) => {
      const {
        price,
        quantity,
        lineTotal,
      } = item;

      if (
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        typeof lineTotal !== "number" ||
        !Number.isFinite(lineTotal) ||
        lineTotal < 0 ||
        Math.round(price * quantity * 100) !==
          Math.round(lineTotal * 100)
      ) {
        throw new Error("Invalid order item amount");
      }

      return sum + lineTotal;
    }, 0) * 100
  ) / 100;

  if (
    typeof subtotal !== "number" ||
    !Number.isFinite(subtotal) ||
    Math.round(subtotal * 100) !==
      Math.round(calculatedSubtotal * 100)
  ) {
    throw new Error("Order subtotal mismatch");
  }

  // 6. Recalculate total
  const discount = coupon?.discountAmount ?? 0;

  const verifiedPayment = calculateFinalAmount({
    subtotal: calculatedSubtotal,
    shippingCharge,
    discount,
  });

  if (
    verifiedPayment.totalAmount !== totalAmount ||
    verifiedPayment.amountInPaise !== amountInPaise
  ) {
    throw new Error("Checkout payment amount mismatch");
  }

  // 7. Default legacy Razorpay allocation
  const allocation =
    paymentBreakdown ??
    (paymentMethod === "Razorpay"
      ? {
          totalPaise: amountInPaise,
          walletPaise: 0,
          razorpayPaise: amountInPaise,
        }
      : null);

  validatePaymentBreakdown({
    paymentMethod,
    paymentBreakdown: allocation,
    totalPaise: amountInPaise,
  });

  const session = await mongoose.startSession();

  let createdOrder = null;

  try {
    await session.withTransaction(async () => {
      // 8. Validate checkout attempt before
      // reserving stock or wallet funds.
      const attempt = await CheckoutAttempt.findOne({
        _id: attemptId,
        user: userId,
        order: null,
        status: "Processing",
        paymentMethod,
      }).session(session);

      if (!attempt) {
        throw new Error(
          "Checkout attempt unavailable or payment method mismatch"
        );
      }

      // 9. Validate coupon rules
      await validateCouponForCheckout({
        couponCode: coupon?.code || null,
        subtotal: calculatedSubtotal,
        expectedDiscount: discount,
        session,
      });

      // 10. Validate shipping charge
      await validateShippingForCheckout({
        expectedShippingCharge: shippingCharge,
        session,
      });

      // 11. Validate products and reserve stock
      for (const item of items) {
        const quantity = Number(item.quantity);

        if (
          !mongoose.isValidObjectId(item.productId) ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          (
            item.variantId &&
            !mongoose.isValidObjectId(item.variantId)
          )
        ) {
          throw new Error("Invalid order item");
        }

        const product = await Product.findById(
          item.productId
        ).session(session);

        if (!product || !product.isListed) {
          throw new Error(
            "Product is unavailable. Please refresh your cart."
          );
        }

        await categoryReservationServices
          .validateCategoryForCheckout({
            categoryId: product.category,
            session,
          });

        const updatedProduct =
          await inventoryServices.reserveStock({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity,
            expectedPrice:
              item.originalPrice ?? item.price,
            session,
          });

        if (!updatedProduct) {
          throw new Error(
            `Product price, stock, or listing has changed for ${
              item.name || "product"
            }. Please refresh your cart.`
          );
        }

        if (
          String(updatedProduct.category) !==
          String(product.category)
        ) {
          throw new Error(
            "Product category changed during checkout"
          );
        }
      }

      // 12. Prepare order item snapshots
      const orderItems = items.map((item) => ({
        product: item.productId,
        name: item.name,
        image: item.image || "",
        variantId: item.variantId || null,
        color: item.color || "",
        size: item.size || "",
        price: item.price,
        originalPrice:
          item.originalPrice ?? item.price,
        offerDiscount: item.offerDiscount || 0,
        appliedOffer: item.appliedOffer || null,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        status: "Pending",
      }));

      // 13. Create pending order
      createdOrder = await orderServices.createOrder(
        {
          user: userId,
          items: orderItems,
          shippingAddress,
          subtotal: calculatedSubtotal,
          coupon: coupon || {
            code: null,
            discountAmount: 0,
          },
          shippingCharge,
          tax: 0,
          totalAmount: verifiedPayment.totalAmount,
          paymentMethod,
          paymentBreakdown: {
            totalPaise: allocation.totalPaise,
            walletPaise: allocation.walletPaise,
            razorpayPaise: allocation.razorpayPaise,
            walletStatus:
              allocation.walletPaise > 0
                ? "Reserved"
                : "Not Used",
          },
          paymentStatus: "Pending",
          orderStatus: "Pending",
        },
        session
      );

      // 14. Reserve wallet contribution
      // in the same MongoDB transaction.
      if (allocation.walletPaise > 0) {
        await reserveForPurchase({
          userId,
          orderId: createdOrder._id,
          amountPaise: allocation.walletPaise,
          session,
        });
      }

      // 15. Reserve stock for 15 minutes
      const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
      );

      await stockReservationServices.createReservation(
        {
          order: createdOrder._id,
          user: userId,
          items: items.map((item) => ({
            product: item.productId,
            variantId: item.variantId || null,
            quantity: item.quantity,
          })),
          status: "Active",
          expiresAt,
        },
        session
      );

      // 16. Link attempt to order
      let linkedAttempt;

      if (paymentMethod === "Razorpay") {
        // Preserve existing Razorpay linking logic.
        linkedAttempt =
          await checkoutAttemptServices.linkAttemptToOrder(
            attemptId,
            userId,
            createdOrder._id,
            cartSnapshotHash,
            verifiedPayment.amountInPaise,
            session
          );

        if (linkedAttempt) {
          linkedAttempt.paymentBreakdown = {
            totalPaise: allocation.totalPaise,
            walletPaise: 0,
            razorpayPaise: allocation.razorpayPaise,
          };

          await linkedAttempt.save({ session });
        }
      } else {
        // Wallet and split payment attempts.
        linkedAttempt =
          await CheckoutAttempt.findOneAndUpdate(
            {
              _id: attemptId,
              user: userId,
              paymentMethod,
              order: null,
              status: "Processing",
              razorpayOrderId: null,
              recoveryRazorpayOrderId: null,
            },
            {
              $set: {
                order: createdOrder._id,
                cartSnapshotHash,
                amountInPaise:
                  allocation.razorpayPaise > 0
                    ? allocation.razorpayPaise
                    : null,
                paymentBreakdown: {
                  totalPaise: allocation.totalPaise,
                  walletPaise: allocation.walletPaise,
                  razorpayPaise: allocation.razorpayPaise,
                },
                currency: "INR",
              },
            },
            {
              new: true,
              runValidators: true,
              session,
            }
          );
      }

      if (!linkedAttempt) {
        throw new Error(
          "Checkout attempt already linked or unavailable"
        );
      }
    });

    return createdOrder;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createPendingOrderWithReservation,
};
