
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

import SalesChart from "../../../components/Admin/SalesChart";
import "./AdminDashboard.css";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statCards = (stats) => [
  { title: "Total Sales", value: currency(stats.totalSales), change: "Collected", icon: IndianRupee, type: "sales" },
  { title: "Total Orders", value: String(stats.totalOrders ?? 0), change: "Selected period", icon: ShoppingBag, type: "orders" },
  { title: "New Customers", value: String(stats.newCustomers ?? 0), change: "Selected period", icon: UserRoundPlus, type: "customers" },
  { title: "Pending Orders", value: String(stats.pendingOrders ?? 0), change: "Needs attention", icon: Scissors, type: "pending" },
];

function AdminDashboard() {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

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

  const query = new URLSearchParams({ period });
  if (period === "custom") { query.set("from", from); query.set("to", to); }
  const queryString = query.toString();

  useEffect(() => {
    if (!admin || (period === "custom" && (!from || !to))) return;
    const controller = new AbortController();
    setStatsLoading(true);
    fetch(`http://localhost:5000/api/admin/dashboard/stats?${queryString}`, {
      credentials: "include", signal: controller.signal,
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Unable to load statistics");
      return r.json();
    }).then((data) => { setReport(data); setError(""); })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setStatsLoading(false); });
    return () => controller.abort();
  }, [admin, queryString, period, from, to]);

  const exportReport = async (format) => {
    setExporting(true); setError("");
    try {
      const r = await fetch(`http://localhost:5000/api/admin/dashboard/export/${format}?${queryString}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `loomzi-report-${period}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); }
    finally { setExporting(false); }
  };

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
     

      <div className="loomzi-dashboard-workspace">

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

              <select aria-label="Report period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="today">Today</option><option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option><option value="year">Last year</option>
                <option value="all">All time</option><option value="custom">Custom dates</option>
              </select>
              {period === "custom" && <><input aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><input aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></>}
              <button type="button" className="loomzi-export-button" onClick={() => exportReport("csv")} disabled={exporting || statsLoading || (period === "custom" && (!from || !to))}><Download size={18} /> Export CSV</button>
              <button type="button" className="loomzi-export-button" onClick={() => exportReport("pdf")} disabled={exporting || statsLoading || (period === "custom" && (!from || !to))}><Download size={18} /> Export PDF</button>
            </div>
          </div>

          {statsLoading && <p>Updating statistics...</p>}
          <div className="loomzi-stats-grid">
            {statCards(report?.stats || {}).map((stat) => {
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

          <SalesChart data={report?.monthlySales || []} />

          <section className="loomzi-orders-card">
            <div className="loomzi-orders-heading">
              <h2>Recent Orders</h2>
              <span className="loomzi-orders-demo">
                Latest orders
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
                  {(report?.recentOrders || []).map((order) => (
                    <tr key={order.id}>
                      <td className="loomzi-order-id">
                        {`#${String(order.id).slice(-8).toUpperCase()}`}
                      </td>

                      <td>{order.customer}</td>
                      <td>{new Date(order.date).toLocaleDateString("en-IN")}</td>
                      <td className="loomzi-order-amount">
                        {currency(order.amount)}
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
