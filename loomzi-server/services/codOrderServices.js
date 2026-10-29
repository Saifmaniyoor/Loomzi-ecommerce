const mongoose = require("mongoose");

const Product = require("../models/Product");
const CheckoutAttempt = require("../models/CheckoutAttempt");

const orderServices = require("./orderServices");
const inventoryServices = require("./inventoryServices");

const categoryReservationServices = require("./categoryReservationServices");

const { validateCouponForCheckout } = require("./couponValidationServices");

const { validateShippingForCheckout } = require("./shippingValidationServices");

const { calculateFinalAmount } = require("../utils/checkoutCalculation");

const cartServices = require("./cartServices");

// ======================================
// Create COD Order Atomically
// ======================================

const createCODOrder = async ({
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

  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid customer ID");
  }

  // 2. Validate items
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain items");
  }

  // 3. Validate cart snapshot
  if (
    typeof cartSnapshotHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(cartSnapshotHash)
  ) {
    throw new Error("Invalid cart snapshot hash");
  }

  // 4. Validate order amount
  if (
    typeof totalAmount !== "number" ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0 ||
    !Number.isSafeInteger(amountInPaise) ||
    amountInPaise < 100 ||
    Math.round(totalAmount * 100) !== amountInPaise
  ) {
    throw new Error("Invalid COD order amount");
  }

  // 5. Calculate subtotal from order items
  const calculatedSubtotal =
    Math.round(
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
          Math.round(price * quantity * 100) !== Math.round(lineTotal * 100)
        ) {
          throw new Error("Invalid COD order item amount");
        }

        return sum + lineTotal;
      }, 0) * 100,
    ) / 100;

  if (
    typeof subtotal !== "number" ||
    !Number.isFinite(subtotal) ||
    Math.round(subtotal * 100) !== Math.round(calculatedSubtotal * 100)
  ) {
    throw new Error("COD order subtotal mismatch");
  }

  // 6. Verify final amount
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
    throw new Error("COD checkout amount mismatch");
  }

  // 7. Start MongoDB transaction
  const session = await mongoose.startSession();

  let createdOrder = null;

  try {
    await session.withTransaction(async () => {
      // 8. Claim the COD attempt inside transaction
      // Prevent concurrent requests from creating
      // duplicate orders using the same attempt.
      const claimedAttempt = await CheckoutAttempt.findOneAndUpdate(
        {
          _id: attemptId,
          user: userId,
          paymentMethod: "COD",
          status: "Processing",
          order: null,
          cartSnapshotHash: null,
        },
        {
          $set: {
            cartSnapshotHash,
            amountInPaise,
            currency: "INR",
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        },
      );

      if (!claimedAttempt) {
        throw new Error("COD checkout attempt is already used or unavailable");
      }

      // 9. Validate coupon inside transaction
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
          (item.variantId && !mongoose.isValidObjectId(item.variantId))
        ) {
          throw new Error("Invalid COD order item");
        }

        const product = await Product.findById(item.productId).session(session);

        if (!product || !product.isListed) {
          throw new Error("Product is unavailable. Please refresh your cart.");
        }

        await categoryReservationServices.validateCategoryForCheckout({
          categoryId: product.category,
          session,
        });

        const updatedProduct = await inventoryServices.reserveStock({
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
            }. Please refresh your cart.`,
          );
        }

        if (String(updatedProduct.category) !== String(product.category)) {
          throw new Error("Product category changed during checkout");
        }
      }

      await cartServices.consumeCartForCheckout({
        userId,
        expectedItems: items,
        session,
      });
      // 12. Create order item snapshots
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
        status: "Confirmed",
      }));

      // 13. Create confirmed COD order
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
          paymentMethod: "COD",
          paymentStatus: "Pending",
          orderStatus: "Confirmed",
          razorpayOrderId: null,
          razorpayPaymentId: null,
        },
        session,
      );

      // 14. Complete checkout attempt
      const completedAttempt = await CheckoutAttempt.findOneAndUpdate(
        {
          _id: attemptId,
          user: userId,
          paymentMethod: "COD",
          status: "Processing",
          order: null,
          cartSnapshotHash,
        },
        {
          $set: {
            order: createdOrder._id,
            status: "Completed",
            errorMessage: null,
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        },
      );

      if (!completedAttempt) {
        throw new Error("Failed to complete COD checkout attempt");
      }
    });

    return createdOrder;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createCODOrder,
};
