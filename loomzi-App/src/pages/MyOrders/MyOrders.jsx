import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyOrders } from "../../services/orderApi";
import "./MyOrders.css";

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchOrders = async () => {
      try {
        const data = await getMyOrders();

        if (!cancelled) {
          setOrders(data);
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

    fetchOrders();

    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <main className="my-orders-page">
      <div className="my-orders-container">
        <div className="my-orders-heading">
          <p className="my-orders-eyebrow">YOUR PURCHASES</p>
          <h1>My Orders</h1>
          <p>View your previous purchases and track their progress.</p>
        </div>

        {loading ? (
          <p>Loading your orders...</p>
        ) : error ? (
          <div className="my-orders-empty" role="alert">
            <h2>Unable to load orders</h2>
            <p>{error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="my-orders-empty">
            <h2>No orders yet</h2>
            <p>You haven't placed any orders yet.</p>
            <Link to="/products" className="my-orders-shop">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="my-orders-list">
            {orders.map((order) => (
              <div className="my-orders-card" key={order.id}>
                <div className="my-orders-card-header">
                  <div>
                    <p>Order #{order.id}</p>
                    <small>Placed on {formatDate(order.createdAt)}</small>
                  </div>

                  <span className="my-orders-status">{order.orderStatus}</span>
                </div>

                <div className="my-orders-card-products">
                  {order.items.map((item) => (
                    <div className="my-orders-product" key={item._id}>
                      {item.image && <img src={item.image} alt={item.name} />}

                      <div>
                        <h3>{item.name}</h3>
                        <p>
                          {item.color} / {item.size}
                        </p>
                        <p>Quantity: {item.quantity}</p>
                        <strong>₹{item.lineTotal}</strong>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="my-orders-card-footer">
                  <div>
                    <p>Payment: {order.paymentMethod}</p>
                    <strong>
                      Total: ₹
                      {Number(order.totalAmount).toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <Link to={`/orders/${order.id}`} className="my-orders-shop">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default MyOrders;
