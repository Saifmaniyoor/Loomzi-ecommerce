
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IndianRupee,
  ShoppingBag,
  UserRoundPlus,
  Scissors,
  Download,
  MailPlus,
  MoreHorizontal,
} from "lucide-react";

import AdminSidebar from "../../../components/Admin/AdminSidebar";
import AdminHeader from "../../../components/Admin/AdminHeader";
import SalesChart from "../../../components/Admin/SalesChart";
import "./AdminDashboard.css";

const stats = [
  {
    title: "Total Sales",
    value: "₹14,285.00",
    change: "+12.5%",
    icon: IndianRupee,
    type: "sales",
  },
  {
    title: "Total Orders",
    value: "428",
    change: "+5.2%",
    icon: ShoppingBag,
    type: "orders",
  },
  {
    title: "New Customers",
    value: "112",
    change: "+8.1%",
    icon: UserRoundPlus,
    type: "customers",
  },
  {
    title: "Pending Orders",
    value: "18",
    change: "High Priority",
    icon: Scissors,
    type: "pending",
  },
];

const recentOrders = [
  {
    id: "#LS-9842",
    customer: "Emily Watson",
    date: "Oct 24, 2024",
    amount: "₹124.00",
    status: "Delivered",
  },
  {
    id: "#LS-9841",
    customer: "Michael Reed",
    date: "Oct 24, 2024",
    amount: "₹45.00",
    status: "In Progress",
  },
  {
    id: "#LS-9840",
    customer: "Jessica Alba",
    date: "Oct 23, 2024",
    amount: "₹210.50",
    status: "Shipped",
  },
  {
    id: "#LS-9839",
    customer: "David Chen",
    date: "Oct 23, 2024",
    amount: "₹55.00",
    status: "In Progress",
  },
];

function AdminDashboard() {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const checkSession = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/admin/dashboard",
          {
            credentials: "include",
            signal: controller.signal,
          }
        );

        if (response.status === 401 || response.status === 403) {
          navigate("/admin/login", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load dashboard");
        }

        const data = await response.json();

        if (data.role !== "super_admin") {
          navigate("/admin/login", { replace: true });
          return;
        }

        setAdmin(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => controller.abort();
  }, [navigate]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/admin/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      navigate("/admin/login", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="loomzi-dashboard-loading">
        Loading dashboard...
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="loomzi-dashboard-loading">
        <p>{error || "Unable to access dashboard"}</p>
        <button onClick={() => navigate("/admin/login")}>
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="loomzi-dashboard-layout">
      <AdminSidebar
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />

      <div className="loomzi-dashboard-workspace">
        <AdminHeader admin={admin} />

        <main className="loomzi-dashboard-content">
          <div className="loomzi-dashboard-title-row">
            <div>
              <h1>Dashboard Overview</h1>
              <p>
                Welcome back! Here's what's happening
                with Loomzi today.
              </p>
            </div>

            <div className="loomzi-dashboard-actions">
              <button
                type="button"
                className="loomzi-invite-button"
                disabled
                title="Vendor invitations coming soon"
              >
                <MailPlus size={18} />
                Invite Vendor
              </button>

              <button
                type="button"
                className="loomzi-export-button"
                disabled
                title="Report export coming soon"
              >
                <Download size={18} />
                Export Report
              </button>
            </div>
          </div>

          <div className="loomzi-stats-grid">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  className="loomzi-stat-card"
                  key={stat.title}
                >
                  <div className="loomzi-stat-top">
                    <div
                      className={`loomzi-stat-icon ${stat.type}`}
                    >
                      <Icon size={22} />
                    </div>

                    <span
                      className={`loomzi-stat-change ${stat.type}`}
                    >
                      {stat.change}
                    </span>
                  </div>

                  <p>{stat.title}</p>
                  <h2>{stat.value}</h2>
                </div>
              );
            })}
          </div>

          <SalesChart />

          <section className="loomzi-orders-card">
            <div className="loomzi-orders-heading">
              <h2>Recent Orders</h2>
              <span className="loomzi-orders-demo">
                Sample data
              </span>
            </div>

            <div className="loomzi-table-scroll">
              <table className="loomzi-orders-table">
                <thead>
                  <tr>
                    <th>ORDER ID</th>
                    <th>CUSTOMER</th>
                    <th>DATE</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="loomzi-order-id">
                        {order.id}
                      </td>

                      <td>{order.customer}</td>
                      <td>{order.date}</td>
                      <td className="loomzi-order-amount">
                        {order.amount}
                      </td>

                      <td>
                        <span
                          className={`loomzi-order-status ${order.status
                            .toLowerCase()
                            .replace(/\s+/g, "-")}`}
                        >
                          {order.status}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="loomzi-order-more"
                          disabled
                          title="Order actions coming soon"
                          aria-label={`Actions for ${order.id}`}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {error && <p role="alert">{error}</p>}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
