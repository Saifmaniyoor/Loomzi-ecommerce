
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  getCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
} from "../../services/cartApi";

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
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState(null);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

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

      await updateCartQuantity(
        item.itemId,
        newQuantity
      );

      await fetchCart();
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
    try {
      setBusyItemId(itemId);
      setError("");
      setRemovingItemId(itemId);

      await removeCartItem(itemId);
      await fetchCart();
      notifyCartUpdated();
    } catch (err) {
      setError(
        err.message || "Failed to remove item"
      );
    } finally {
      setBusyItemId(null);
      setRemovingItemId(null);
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

  const items = cart?.items || [];

  const isBusy = busyItemId !== null || clearing;

  const hasUnavailableItems =
    cart?.hasUnavailableItems ||
    items.some((item) => item.available === false);

  const finalTotal = Number(cart?.total ?? 0);

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

                const stock = Number(
                  item.stock ?? 0
                );

                const isAvailable =
                  item.available !== false;

                const regularPrice = Number(
                  item.originalPrice ?? item.price ?? 0
                );

                const finalPrice = Number(
                  item.price ?? 0
                );

                const hasDiscount =
                  isAvailable &&
                  Number.isFinite(regularPrice) &&
                  Number.isFinite(finalPrice) &&
                  regularPrice > finalPrice;

                const offerPercentage = Number(
                  item.appliedOffer?.discountPercentage ?? 0
                );

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
                        <div className="cart-item-price cart-offer-prices">
                          <span className="cart-final-price">
                            {formatPrice(item.price)}
                          </span>

                          {hasDiscount && (
                            <span className="cart-regular-price">
                              {formatPrice(regularPrice)}
                            </span>
                          )}
                        </div>
                      )}

                      {hasDiscount && item.appliedOffer?.name && (
                        <div className="cart-offer-tags">
                          <span className="cart-offer-name">
                            {item.appliedOffer.name}
                          </span>

                          {offerPercentage > 0 && (
                            <span className="cart-offer-percent">
                              {offerPercentage}% OFF
                            </span>
                          )}
                        </div>
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
                          {removingItemId === itemId
                            ? "Removing..."
                            : "Remove"}
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
                onClick={() => navigate("/checkout")}
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
