
const mongoose = require("mongoose");

const Product = require("../models/Product");

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
  validateCouponForCheckout,
} = require("./couponValidationServices");

// NEW: Shipping validation service
const {
  validateShippingForCheckout,
} = require("./shippingValidationServices");

// Create pending order and reserve stock atomically.
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
}) => {
  // 1. Validate checkout attempt ID
  if (!mongoose.isValidObjectId(attemptId)) {
    throw new Error("Invalid checkout attempt ID");
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

  // 4. Validate payment amount
  if (
    typeof totalAmount !== "number" ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0 ||
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100 ||
    Math.round(totalAmount * 100) !== amountInPaise
  ) {
    throw new Error("Invalid payment amount");
  }

  // 5. Validate item prices and calculate subtotal
  const calculatedSubtotal = Math.round(
    items.reduce((sum, item) => {
      const price = item.price;
      const quantity = item.quantity;
      const lineTotal = item.lineTotal;

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

  // 6. Verify order subtotal
  if (
    typeof subtotal !== "number" ||
    !Number.isFinite(subtotal) ||
    Math.round(subtotal * 100) !==
      Math.round(calculatedSubtotal * 100)
  ) {
    throw new Error("Order subtotal mismatch");
  }

  // 7. Verify discount and final payment amount
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

  // 8. Start MongoDB session
  const session = await mongoose.startSession();

  let createdOrder = null;

  try {
    await session.withTransaction(async () => {
      // 9. Validate current coupon rules
      await validateCouponForCheckout({
        couponCode: coupon?.code || null,
        subtotal: calculatedSubtotal,
        expectedDiscount: discount,
        session,
      });

      // 10. NEW: Validate current shipping charge
      await validateShippingForCheckout({
        expectedShippingCharge: shippingCharge,
        session,
      });

      // 11. Validate categories and reserve stock
      for (const item of items) {
        const quantity = Number(item.quantity);

        if (
          !mongoose.isValidObjectId(item.productId) ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          (item.variantId &&
            !mongoose.isValidObjectId(item.variantId))
        ) {
          throw new Error("Invalid order item");
        }

        // Read product inside transaction
        const product = await Product.findById(
          item.productId
        ).session(session);

        if (!product || !product.isListed) {
          throw new Error(
            "Product is unavailable. Please refresh your cart."
          );
        }

        // Validate category availability
        await categoryReservationServices
          .validateCategoryForCheckout({
            categoryId: product.category,
            session,
          });

        // Reserve stock using expected price
        const updatedProduct =
          await inventoryServices.reserveStock({
            productId: item.productId,
            variantId: item.variantId || null,
            quantity,
            expectedPrice: item.originalPrice ?? item.price,
            session,
          });

        if (!updatedProduct) {
          throw new Error(
            `Product price, stock, or listing has changed for ${
              item.name || "product"
            }. Please refresh your cart.`
          );
        }

        // Verify category did not change
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
        originalPrice: item.originalPrice ?? item.price,
        offerDiscount: item.offerDiscount || 0,
        appliedOffer: item.appliedOffer || null,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        status: "Pending",
      }));

      // 13. Create pending Loomzi order
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
          paymentMethod: "Razorpay",
          paymentStatus: "Pending",
          orderStatus: "Pending",
        },
        session
      );

      // 14. Create stock reservation (15 minutes)
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

      // 15. Link checkout attempt to order
      const linkedAttempt =
        await checkoutAttemptServices.linkAttemptToOrder(
          attemptId,
          userId,
          createdOrder._id,
          cartSnapshotHash,
          verifiedPayment.amountInPaise,
          session
        );

      if (!linkedAttempt) {
        throw new Error(
          "Checkout attempt already linked or unavailable"
        );
      }
    });

    // 16. Return created order
    return createdOrder;
  } finally {
    // 17. Close MongoDB session
    await session.endSession();
  }
};

module.exports = {
  createPendingOrderWithReservation,
};
