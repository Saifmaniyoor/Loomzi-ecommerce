
const crypto = require("node:crypto");

const createCartSnapshotHash = ({
  items,
  addressId,
  couponCode,
  subtotal,
  discount,
  shippingCharge,
  totalAmount,
}) => {
  const normalizedItems = items
    .map((item) => ({
      productId: String(item.productId),
      variantId: item.variantId
        ? String(item.variantId)
        : null,
      price: Number(item.price),
      quantity: Number(item.quantity),
      lineTotal: Number(item.lineTotal),
    }))
    .sort((a, b) => {
      const first =
        `${a.productId}:${a.variantId || ""}`;

      const second =
        `${b.productId}:${b.variantId || ""}`;

      return first.localeCompare(second);
    });

  const snapshot = {
    items: normalizedItems,
    addressId: String(addressId),
    couponCode: couponCode || "",
    subtotal,
    discount,
    shippingCharge,
    totalAmount,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
};

module.exports = {
  createCartSnapshotHash,
};
