
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  getCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
} from "../../services/cartApi";

import { validateCoupon } from "../../services/couponApi";

import "./Cart.css";

const formatPrice = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

const notifyCartUpdated = () => {
  window.dispatchEvent(new Event("loomzi:cart-updated"));
};

const normalizeCart = (response) => {
  const data = response?.cart ?? response;

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    subtotal: Number(data?.subtotal ?? 0),
    shippingCharge: Number(data?.shippingCharge ?? 0),
    total: Number(data?.total ?? 0),
    hasUnavailableItems: Boolean(data?.hasUnavailableItems),
  };
};

function Cart() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  // Coupon states
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const fetchCart = useCallback(async () => {
    try {
      const response = await getCart();
      setCart(normalizeCart(response));
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load cart");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Revalidate an applied coupon whenever the cart changes.
  const refreshAppliedCoupon = async (code) => {
    if (!code) return;

    try {
      const result = await validateCoupon(code);
      setAppliedCoupon(result);
      setCouponError("");
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(
        err.message || "Coupon is no longer valid"
      );
    }
  };

  const handleQuantityChange = async (item, change) => {
    const newQuantity = item.quantity + change;

    if (newQuantity < 1) return;

    if (
      item.stock != null &&
      newQuantity > Number(item.stock)
    ) {
      return;
    }

    try {
      setBusyItemId(item.itemId);
      setError("");
      setAppliedCoupon(null);

      await updateCartQuantity(
        item.itemId,
        newQuantity
      );

      await fetchCart();

      if (appliedCoupon?.coupon?.code) {
        await refreshAppliedCoupon(
          appliedCoupon.coupon.code
        );
      }

      notifyCartUpdated();
    } catch (err) {
      setError(
        err.message || "Failed to update quantity"
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleRemove = async (itemId) => {
    const previousCouponCode =
      appliedCoupon?.coupon?.code;

    try {
      setBusyItemId(itemId);
      setError("");
      setAppliedCoupon(null);

      await removeCartItem(itemId);
      await fetchCart();

      if (previousCouponCode) {
        await refreshAppliedCoupon(
          previousCouponCode
        );
      }

      notifyCartUpdated();
    } catch (err) {
      setError(
        err.message || "Failed to remove item"
      );
    } finally {
      setBusyItemId(null);
    }
  };

  const handleClearCart = async () => {
    const confirmed = window.confirm(
      "Remove all items from your cart?"
    );

    if (!confirmed) return;

    try {
      setClearing(true);
      setError("");

      await clearCart();

      setAppliedCoupon(null);
      setCouponCode("");
      setCouponError("");

      await fetchCart();
      notifyCartUpdated();
    } catch (err) {
      setError(
        err.message || "Failed to clear cart"
      );
    } finally {
      setClearing(false);
    }
  };

  const handleApplyCoupon = async (event) => {
    event.preventDefault();

    const code = couponCode.trim().toUpperCase();

    if (!code) {
      setCouponError("Please enter a coupon code");
      return;
    }

    try {
      setCouponLoading(true);
      setCouponError("");
      setAppliedCoupon(null);

      const result = await validateCoupon(code);

      setAppliedCoupon(result);
      setCouponCode(result.coupon.code);
    } catch (err) {
      setCouponError(
        err.message || "Unable to apply coupon"
      );
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  const items = cart?.items || [];

  const isBusy =
    busyItemId !== null ||
    clearing ||
    couponLoading;

  const hasUnavailableItems =
    cart?.hasUnavailableItems ||
    items.some((item) => item.available === false);

  // The validated response is only a preview.
  const discount = Number(
    appliedCoupon?.discount ?? 0
  );

  const finalTotal = appliedCoupon
    ? Number(appliedCoupon.finalTotal)
    : Number(cart?.total ?? 0);

  const minimumPurchase = 500;

  const remainingAmount = Math.max(
    0,
    minimumPurchase - Number(cart?.subtotal ?? 0)
  );

  if (loading) {
    return (
      <main className="cart-page">
        <p className="cart-status">
          Loading your cart...
        </p>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <div className="cart-container">
        <div className="cart-heading">
          <div>
            <p className="cart-eyebrow">
              YOUR SELECTIONS
            </p>
            <h1>Your Shopping Cart</h1>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              className="cart-clear-button"
              onClick={handleClearCart}
              disabled={isBusy}
            >
              {clearing ? "Clearing..." : "Clear Cart"}
            </button>
          )}
        </div>

        {error && (
          <div className="cart-error" role="alert">
            {error}
            <button
              type="button"
              onClick={fetchCart}
              style={{ marginLeft: "12px" }}
            >
              Retry
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="cart-empty">
            <h2>Your cart is empty</h2>
            <p>
              Explore our handmade collections
              and find something special.
            </p>

            <Link
              to="/products"
              className="cart-shop-button"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <section className="cart-items">
              {items.map((item) => {
                const itemId =
                  item.itemId ?? item._id;

                const busy =
                  busyItemId === itemId;

                const stock = Number(
                  item.stock ?? 0
                );

                const isAvailable =
                  item.available !== false;

                return (
                  <article
                    className="cart-item"
                    key={itemId}
                  >
                    <Link
                      to={`/products/${item.productId}`}
                      className="cart-item-image-link"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="cart-item-image"
                        />
                      ) : (
                        <div className="cart-image-placeholder">
                          No Image
                        </div>
                      )}
                    </Link>

                    <div className="cart-item-info">
                      <Link
                        to={`/products/${item.productId}`}
                        className="cart-item-name"
                      >
                        {item.name}
                      </Link>

                      {(item.color || item.size) && (
                        <p className="cart-item-variant">
                          {item.color && (
                            <span>
                              Color: {item.color}
                            </span>
                          )}
                          {item.size && (
                            <span>
                              Size: {item.size}
                            </span>
                          )}
                        </p>
                      )}

                      {item.price != null && (
                        <p className="cart-item-price">
                          {formatPrice(item.price)}
                        </p>
                      )}

                      {!isAvailable && (
                        <p className="cart-item-warning">
                          {item.message ||
                            "This item is unavailable or has insufficient stock."}
                        </p>
                      )}

                      <div className="cart-item-actions">
                        <div className="cart-quantity">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={
                              isBusy ||
                              !isAvailable ||
                              item.quantity <= 1
                            }
                            onClick={() =>
                              handleQuantityChange(
                                { ...item, itemId },
                                -1
                              )
                            }
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            aria-label="Increase quantity"
                            disabled={
                              isBusy ||
                              !isAvailable ||
                              item.quantity >= stock
                            }
                            onClick={() =>
                              handleQuantityChange(
                                { ...item, itemId },
                                1
                              )
                            }
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="cart-remove-button"
                          disabled={isBusy}
                          onClick={() =>
                            handleRemove(itemId)
                          }
                        >
                          {busy ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>

                    {item.lineTotal != null && (
                      <div className="cart-item-total">
                        {formatPrice(item.lineTotal)}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <aside className="cart-summary">
              <h2>Order Summary</h2>

              <div className="cart-summary-row">
                <span>Subtotal</span>
                <span>
                  {formatPrice(cart.subtotal)}
                </span>
              </div>

              <div className="cart-summary-row">
                <span>Shipping</span>
                <span>
                  {formatPrice(cart.shippingCharge)}
                </span>
              </div>

              {/* Coupon section */}
              <div className="cart-coupon-section">
                <h3>Have a coupon?</h3>

                {remainingAmount > 0 && (
                  <p className="cart-coupon-hint">
                    Add {formatPrice(remainingAmount)} more
                    to unlock LOOMZI10.
                  </p>
                )}

                <form
                  onSubmit={handleApplyCoupon}
                  className="cart-coupon-form"
                >
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(event) => {
                      setCouponCode(event.target.value);
                      setCouponError("");
                    }}
                    placeholder="Enter coupon code"
                    aria-label="Coupon code"
                    disabled={
                      isBusy ||
                      Boolean(appliedCoupon)
                    }
                  />

                  {appliedCoupon ? (
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      disabled={isBusy}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        isBusy ||
                        hasUnavailableItems ||
                        remainingAmount > 0
                      }
                    >
                      {couponLoading
                        ? "Applying..."
                        : "Apply"}
                    </button>
                  )}
                </form>

                {couponError && (
                  <p
                    className="cart-coupon-error"
                    role="alert"
                  >
                    {couponError}
                  </p>
                )}

                {appliedCoupon && (
                  <p className="cart-coupon-success">
                    Coupon {appliedCoupon.coupon.code}
                    {" "}applied successfully!
                  </p>
                )}
              </div>

              {appliedCoupon && (
                <div className="cart-summary-row">
                  <span>
                    Coupon Discount
                    ({appliedCoupon.coupon.code})
                  </span>
                  <span className="cart-discount">
                    −{formatPrice(discount)}
                  </span>
                </div>
              )}

              <div className="cart-summary-divider" />

              <div className="cart-summary-row cart-grand-total">
                <span>Total</span>
                <span>
                  {formatPrice(finalTotal)}
                </span>
              </div>

              <button
                type="button"
                className="cart-checkout-button"
                disabled={
                  isBusy ||
                  hasUnavailableItems
                }
                onClick={() =>
                  window.alert(
                    "Checkout will be implemented in the next module."
                  )
                }
              >
                Proceed to Checkout
              </button>

              {hasUnavailableItems && (
                <p className="cart-checkout-note">
                  Please remove unavailable items
                  before proceeding to checkout.
                </p>
              )}

              <Link
                to="/products"
                className="cart-continue-shopping"
              >
                ← Continue Shopping
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default Cart;
