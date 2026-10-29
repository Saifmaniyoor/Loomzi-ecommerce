import { Fragment, useCallback, useEffect, useState } from "react";
import "./OrderManagement.css";
const API = "http://localhost:5000/api/admin/orders";
const statuses = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled"];
async function api(path = "", options = {}) {
  const response = await fetch(API + path, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
export default function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await api(`?page=${page}&status=${encodeURIComponent(filter)}`);
      setOrders(data.orders || []); setPages(data.pages || 1);
    } catch (e) { setError(e.message); }
  }, [page, filter]);
  useEffect(() => { load(); }, [load]);
  const open = async (id) => {
    setError("");
    try {
      const { order } = await api(`/${id}`);
      setSelected(order);
      setForm({ status: order.orderStatus, note: "", courier: order.tracking?.courier || "", trackingNumber: order.tracking?.trackingNumber || "", trackingUrl: order.tracking?.trackingUrl || "", estimatedDelivery: order.tracking?.estimatedDelivery ? new Date(order.tracking.estimatedDelivery).toISOString().slice(0, 10) : "" });
    } catch (e) { setError(e.message); }
  };
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const { order } = await api(`/${selected._id}/delivery`, { method: "PATCH", body: JSON.stringify(form) });
      setSelected(order); setNotice("Delivery details updated"); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  return <main className="loomzi-order-admin">
    <h1>Order Management</h1><p>Update delivery progress and courier details. Customers can view these updates in My Orders.</p>
    {error && <p role="alert" className="oa-error">{error}</p>}{notice && <p role="status" className="oa-success">{notice}</p>}
    <label>Filter by status <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}><option value="">All orders</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label>
    <div className="oa-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Delivery</th><th>Action</th></tr></thead><tbody>
      {orders.map((o) => (
        <Fragment key={o._id}>
          <tr className={selected?._id === o._id ? "oa-selected-row" : ""}>
            <td>#{o._id.slice(-8).toUpperCase()}</td>
            <td>{o.user?.fullName || o.shippingAddress?.fullName || "Customer"}<small>{o.user?.email}</small></td>
            <td>{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
            <td>{money(o.totalAmount)}</td>
            <td>{o.paymentMethod} · {o.paymentStatus}</td>
            <td>{o.orderStatus}</td>
            <td><button type="button" onClick={() => selected?._id === o._id ? setSelected(null) : open(o._id)}>{selected?._id === o._id ? "Close" : "Manage"}</button></td>
          </tr>
          {selected?._id === o._id && (
            <tr className="oa-expanded-row"><td colSpan="7">
              <section className="oa-detail"><div className="oa-heading"><h2>Order #{selected._id.slice(-8).toUpperCase()}</h2><button onClick={() => setSelected(null)}>Close</button></div>
      <p><strong>Customer:</strong> {selected.shippingAddress?.fullName} · {selected.shippingAddress?.phone}</p>
      <p><strong>Address:</strong> {[selected.shippingAddress?.addressLine1, selected.shippingAddress?.city, selected.shippingAddress?.state, selected.shippingAddress?.pincode].filter(Boolean).join(", ")}</p>
      <p><strong>Payment:</strong> {selected.paymentMethod} · {selected.paymentStatus} · {money(selected.totalAmount)}</p>
      <h3>Products</h3>{selected.items.map((item) => <p key={item._id}>{item.name} × {item.quantity} — {money(item.lineTotal)}</p>)}
      <form className="oa-form" onSubmit={save}>
        <label>Delivery status<select value={form.status} onChange={(e) => set("status", e.target.value)}>{statuses.filter((s) => s !== "Cancelled").map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Courier<input value={form.courier} maxLength={100} onChange={(e) => set("courier", e.target.value)} placeholder="Courier company" /></label>
        <label>Tracking number<input value={form.trackingNumber} maxLength={120} onChange={(e) => set("trackingNumber", e.target.value)} /></label>
        <label>Tracking URL (HTTPS)<input type="url" value={form.trackingUrl} onChange={(e) => set("trackingUrl", e.target.value)} placeholder="https://..." /></label>
        <label>Estimated delivery<input type="date" value={form.estimatedDelivery} onChange={(e) => set("estimatedDelivery", e.target.value)} /></label>
        <label className="oa-wide">Delivery update note<textarea maxLength={500} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Package dispatched from warehouse" /></label>
        <button disabled={busy || selected.orderStatus === "Cancelled"} type="submit">{busy ? "Saving..." : "Save delivery update"}</button>
      </form>
      <h3>Update history</h3>{(selected.statusHistory || []).slice().reverse().map((h, i) => <p key={i}><strong>{h.status}</strong> · {new Date(h.changedAt).toLocaleString("en-IN")}{h.note ? ` — ${h.note}` : ""}</p>)}
</section>
            </td></tr>
          )}
        </Fragment>
      ))}
      {!orders.length && <tr><td colSpan="7">No orders found</td></tr>}
    </tbody></table></div>
    <div className="oa-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
  </main>;
}
