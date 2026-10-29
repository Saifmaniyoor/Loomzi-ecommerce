import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrderById } from "../../services/orderApi";
import "./OrderSuccess.css";

function OrderSuccess() {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchOrder = async () => {
      setLoading(true);
      setError("");
      setOrder(null);

      try {
        const orderData = await getOrderById(orderId);

        if (!cancelled) {
          setOrder(orderData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <main className="order-success-page">
        <p>Loading order details...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="order-success-page">
        <div className="order-success-container">
          <h2>Unable to load order</h2>
          <p>{error || "Order not found"}</p>
          <Link to="/products">Continue Shopping</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="order-success-page">
      <div className="order-success-container">
        <div className="order-success-icon">
          <span>✓</span>
        </div>

        <h1>Thank You for Your Order!</h1>

        <p className="order-success-number">Order Number: #{order.id}</p>

        <p className="order-success-message">
          We've received your order and are getting it ready with love.
        </p>

        <div className="order-success-products">
          <h2>Items in Your Order</h2>

          {order.items.map((item) => (
            <div className="order-success-product" key={item._id}>
              <img
                src={item.image}
                alt={item.name}
                className="order-success-product-image"
              />

              <div className="order-success-product-info">
                <h3>{item.name}</h3>

                <p>
                  Color: {item.color} | Size: {item.size}
                </p>

                <p>Quantity: {item.quantity}</p>

                <p>
                  <strong>₹{item.lineTotal}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="order-success-details">
          <p>
            <strong>Order Total:</strong> ₹{order.totalAmount}
          </p>

          <p>
            <strong>Payment Method:</strong> {order.paymentMethod}
          </p>

          <p>
            <strong>Order Status:</strong> {order.orderStatus}
          </p>
        </div>

        <div className="order-success-shipping">
          <h2>Delivery Address</h2>

          <p>
            <strong>{order.shippingAddress.fullName}</strong>
          </p>
          <p>{order.shippingAddress.addressLine1}</p>

          {order.shippingAddress.addressLine2 && (
            <p>{order.shippingAddress.addressLine2}</p>
          )}

          {order.shippingAddress.landmark && (
            <p>Landmark: {order.shippingAddress.landmark}</p>
          )}

          <p>
            {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
            {order.shippingAddress.pincode}
          </p>

          <p>Phone: {order.shippingAddress.phone}</p>
        </div>

        <div className="order-success-summary">
          <h2>Order Summary</h2>

          <div className="order-success-summary-row">
            <span>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>

          {order.coupon?.discountAmount > 0 && (
            <div className="order-success-summary-row">
              <span>Coupon Discount ({order.coupon.code})</span>
              <span>-₹{order.coupon.discountAmount}</span>
            </div>
          )}

          <div className="order-success-summary-row">
            <span>Shipping</span>
            <span>₹{order.shippingCharge}</span>
          </div>

          {order.tax > 0 && (
            <div className="order-success-summary-row">
              <span>Tax</span>
              <span>₹{order.tax}</span>
            </div>
          )}

          <div className="order-success-summary-row order-success-summary-total">
            <strong>Total</strong>
            <strong>₹{order.totalAmount}</strong>
          </div>
        </div>

        <div className="order-success-actions">
          <Link to="/orders" className="order-success-track">
            Track My Order
          </Link>

          <Link to="/products" className="order-success-shop">
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

export default OrderSuccess;
