import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrderById, cancelOrder } from "../../services/orderApi";
import "./OrderDetails.css";

function OrderDetails() {
  const { orderId } = useParams();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchOrder = async () => {
      setLoading(true);
      setError("");
      setOrder(null);

      try {
        const data = await getOrderById(orderId);

        if (!cancelled) {
          setOrder(data);
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

  const handleCancelOrder = async () => {
    if (!order || cancelling) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this order?",
    );

    if (!confirmed) return;

    setCancelling(true);
    setCancelError("");
    setCancelSuccess("");

    try {
      await cancelOrder(order.id);

      setOrder((previousOrder) => ({
        ...previousOrder,
        orderStatus: "Cancelled",
        items: previousOrder.items.map((item) => ({
          ...item,
          status: "Cancelled",
        })),
      }));

      setCancelSuccess("Your order has been cancelled successfully.");
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main className="order-details-page">
        <p>Loading order details...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="order-details-page">
        <h2>Unable to load order</h2>
        <p>{error || "Order not found"}</p>
        <Link to="/orders">Back to My Orders</Link>
      </main>
    );
  }

  const address = order.shippingAddress;

  const statusSteps = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered"];

  const currentStatus = order.orderStatus;
  const canCancel =
    ["Pending", "Confirmed", "Processing"].includes(order.orderStatus) &&
    ((order.paymentMethod === "COD" && order.paymentStatus === "Pending") ||
      (order.paymentMethod === "Razorpay" &&
        order.paymentStatus === "Paid" && Boolean(order.razorpayPaymentId)));


  const isCancelled =
    currentStatus?.toLowerCase() === "cancelled" ||
    currentStatus?.toLowerCase() === "canceled";

  const currentStep = statusSteps.findIndex(
    (step) => step.toLowerCase() === currentStatus?.toLowerCase(),
  );

  return (
    <main className="order-details-page">
      <div className="order-details-container">
        <Link to="/my-orders" className="order-details-back">
          ← Back to My Orders
        </Link>

        <h1>Order Details</h1>

        <p className="order-details-number">Order #{order.id}</p>

        <div className="order-details-status">
          <p>
            <strong>Order Status:</strong> {order.orderStatus}
          </p>
          <p>
            <strong>Payment:</strong> {order.paymentMethod}
          </p>
          <p>
            <strong>Payment Status:</strong> {order.paymentStatus}
          </p>

          <p className="order-cancellation-policy">
            Cancellation is available before shipment for eligible orders. Once shipped,
            standard cancellation is unavailable. See our{" "}
            <Link to="/cancellation-policy">Cancellation &amp; Returns Policy</Link>.
          </p>
          {canCancel && (
            <div className="order-cancel-actions">
              <button
                type="button"
                className="order-cancel-button"
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Cancel Order"}
              </button>
            </div>
          )}

          {cancelError && (
            <p className="order-cancel-error" role="alert">
              {cancelError}
            </p>
          )}

          {cancelSuccess && (
            <p className="order-cancel-success" role="status">
              {cancelSuccess}
            </p>
          )}
        </div>

        <section className="order-details-section">
          <h2>Order Tracking</h2>

          {isCancelled ? (
            <div className="order-cancelled-message">
              <h3>Order Cancelled</h3>
              <p>This order has been cancelled.</p>
            </div>
          ) : currentStep === -1 ? (
            <p>Current status: {currentStatus}</p>
          ) : (
            <div className="order-tracking-timeline">
              {statusSteps.map((step, index) => (
                <div
                  className={`order-tracking-step ${
                    index <= currentStep ? "completed" : ""
                  }`}
                  key={step}
                >
                  <span className="order-tracking-dot">
                    {index <= currentStep ? "✓" : ""}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="order-details-section">
          <h2>Delivery Updates</h2>
          {order.tracking?.courier && <p><strong>Courier:</strong> {order.tracking.courier}</p>}
          {order.tracking?.trackingNumber && <p><strong>Tracking number:</strong> {order.tracking.trackingNumber}</p>}
          {order.tracking?.estimatedDelivery && <p><strong>Estimated delivery:</strong> {new Date(order.tracking.estimatedDelivery).toLocaleDateString("en-IN")}</p>}
          {order.tracking?.trackingUrl?.startsWith("https://") && <p><a href={order.tracking.trackingUrl} target="_blank" rel="noopener noreferrer">Track with courier ↗</a></p>}
          {(order.statusHistory || []).length ? <ol className="loomzi-delivery-history">{order.statusHistory.slice().reverse().map((entry, index) => <li key={index}><strong>{entry.status}</strong> · {new Date(entry.changedAt).toLocaleString("en-IN")}{entry.note && <p>{entry.note}</p>}</li>)}</ol> : <p>Delivery updates will appear here when the admin updates your order.</p>}
        </section>

        <section className="order-details-section">
          <h2>Ordered Products</h2>

          {order.items.map((item) => (
            <div className="order-details-product" key={item._id}>
              {item.image && <img src={item.image} alt={item.name} />}

              <div>
                <h3>{item.name}</h3>
                <p>
                  {item.color} / {item.size}
                </p>
                <p>Quantity: {item.quantity}</p>
                <strong>₹{item.lineTotal}</strong>
                {(item.status === "Delivered" || (!item.status && order.orderStatus === "Delivered")) && order.paymentStatus === "Paid" && item.product && (
                  <div className="order-product-review-action">
                    <Link to={`/products/${typeof item.product === "object" ? item.product._id : item.product}?tab=reviews`} className="order-write-review">
                      ★ Write a Review
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        <section className="order-details-section">
          <h2>Delivery Address</h2>

          <p>
            <strong>{address.fullName}</strong>
          </p>
          <p>{address.addressLine1}</p>
          {address.addressLine2 && <p>{address.addressLine2}</p>}
          {address.landmark && <p>Landmark: {address.landmark}</p>}
          <p>
            {address.city}, {address.state} - {address.pincode}
          </p>
          <p>Phone: {address.phone}</p>
        </section>

        <section className="order-details-section">
          <h2>Payment Summary</h2>

          <div className="order-details-row">
            <span>Subtotal</span>
            <span>₹{order.subtotal}</span>
          </div>

          {order.coupon?.discountAmount > 0 && (
            <div className="order-details-row">
              <span>Coupon Discount</span>
              <span>-₹{order.coupon.discountAmount}</span>
            </div>
          )}

          <div className="order-details-row">
            <span>Shipping</span>
            <span>₹{order.shippingCharge}</span>
          </div>

          {order.tax > 0 && (
            <div className="order-details-row">
              <span>Tax</span>
              <span>₹{order.tax}</span>
            </div>
          )}

          <div className="order-details-row order-details-total">
            <strong>Total Amount</strong>
            <strong>₹{order.totalAmount}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}

export default OrderDetails;
