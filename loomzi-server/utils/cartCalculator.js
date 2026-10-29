
const cartServices = require("../services/cartServices");
const {
  loadActiveOffers,
  calculateOfferPrice,
} = require("../services/offerPricingServices");

const roundAmount = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;

const findVariant = (product, variantId) => {
  if (!variantId) return null;

  return product.variants?.find(
    (variant) =>
      String(variant._id) === String(variantId)
  );
};

const getProductAvailability = (product, variantId) => {
  if (!product || !product.isListed) {
    return { error: "Product is unavailable" };
  }

  if (!product.category?.isListed) {
    return { error: "Product category is unavailable" };
  }

  const hasVariants = product.variants?.length > 0;

  if (hasVariants) {
    const variant = findVariant(product, variantId);

    if (!variant) {
      return {
        error: "Please select a valid product variant",
      };
    }

    return {
      stock: Number(variant.stock || 0),
      price:
        variant.price != null
          ? Number(variant.price)
          : Number(product.price),
      variant,
    };
  }

  if (variantId) {
    return { error: "This product has no variants" };
  }

  return {
    stock: Number(product.stock || 0),
    price: Number(product.price),
    variant: null,
  };
};

const calculateCartSummary = async (userId) => {
  const cart = await cartServices.findCartWithProducts(userId);
  const settings = await cartServices.findShippingSettings();
  const activeOffers = await loadActiveOffers();

  const items = [];
  let subtotal = 0;
  let totalSavings = 0;
  let hasUnavailableItems = false;

  for (const item of cart?.items || []) {
    const product = item.product;

    if (!product) {
      hasUnavailableItems = true;

      items.push({
        itemId: item._id,
        quantity: item.quantity,
        available: false,
        message: "Product no longer exists",
      });

      continue;
    }

    const fullProduct = await cartServices.findProductById(
      product._id
    );

    const availability = getProductAvailability(
      fullProduct,
      item.variantId
    );

    if (availability.error) {
      hasUnavailableItems = true;

      items.push({
        itemId: item._id,
        productId: product._id,
        name: product.name,
        image: product.images?.[0] || "",
        quantity: item.quantity,
        available: false,
        message: availability.error,
      });

      continue;
    }

    const quantity = Number(item.quantity);

    const offerPrice = calculateOfferPrice({
      productId: fullProduct._id,
      categoryId:
        fullProduct.category?._id || fullProduct.category,
      price: availability.price,
      manualOfferPrice:
        availability.variant?.offerPrice ??
        fullProduct.offerPrice,
      offers: activeOffers,
    });

    const price = offerPrice.price;
    const stock = availability.stock;

    const isAvailable =
      Number.isInteger(quantity) &&
      quantity > 0 &&
      Number.isFinite(price) &&
      price >= 0 &&
      Number.isFinite(stock) &&
      stock >= quantity;

    if (!isAvailable) {
      hasUnavailableItems = true;
    }

    const lineTotal = isAvailable
      ? roundAmount(price * quantity)
      : 0;

    if (isAvailable) {
      subtotal = roundAmount(subtotal + lineTotal);

      // Savings are measured against the original regular price.
      const originalPrice = Number(offerPrice.originalPrice);

      if (
        Number.isFinite(originalPrice) &&
        originalPrice >= 0
      ) {
        const originalLineTotal = roundAmount(
          originalPrice * quantity
        );

        totalSavings = roundAmount(
          totalSavings +
            Math.max(0, originalLineTotal - lineTotal)
        );
      }
    }

    items.push({
      itemId: item._id,
      productId: product._id,
      name: product.name,
      image: product.images?.[0] || "",
      variantId: item.variantId,
      color: availability.variant?.color || "",
      size: availability.variant?.size || "",
      price,
      originalPrice: offerPrice.originalPrice,
      offerDiscount: offerPrice.offerDiscount,
      appliedOffer: offerPrice.appliedOffer,
      quantity,
      stock,
      available: isAvailable,
      message: isAvailable
        ? ""
        : "Insufficient stock or invalid product price",
      lineTotal,
    });
  }

  const shippingCharge =
    items.length > 0
      ? Number(settings?.shippingCharge ?? 50)
      : 0;

  if (
    !Number.isFinite(shippingCharge) ||
    shippingCharge < 0
  ) {
    throw new Error("Invalid shipping configuration");
  }

  return {
    items,
    subtotal: roundAmount(subtotal),
    totalSavings: roundAmount(totalSavings),
    shippingCharge: roundAmount(shippingCharge),
    tax: 0,
    total: roundAmount(subtotal + shippingCharge),
    hasUnavailableItems,
  };
};

module.exports = {
  getProductAvailability,
  calculateCartSummary,
  roundAmount,
};
