const Order = require("../models/Order");
const User = require("../models/User");

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const periodFilter = (query) => {
  const period = String(query.period || "month");
  const now = new Date();
  let start;
  if (period === "today") { start = new Date(now); start.setHours(0, 0, 0, 0); }
  else if (period === "week") start = new Date(now.getTime() - 7 * 86400000);
  else if (period === "month") start = new Date(now.getTime() - 30 * 86400000);
  else if (period === "year") start = new Date(now.getTime() - 365 * 86400000);
  else if (period === "all") start = null;
  else if (period === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(query.to || "")) throw new Error("Choose valid From and To dates");
    start = new Date(`${query.from}T00:00:00+05:30`);
    const end = new Date(`${query.to}T23:59:59.999+05:30`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end || end > now) throw new Error("Invalid date range");
    return { period, start, end, filter: { createdAt: { $gte: start, $lte: end } } };
  } else throw new Error("Invalid reporting period");
  return { period, start, end: now, filter: { createdAt: { ...(start ? { $gte: start } : {}), $lte: now } } };
};

// Collected sales: fully paid orders, less known refunds. A partial refund
// with no recorded amount is omitted rather than presented as exact revenue.
const revenue = (order) => {
  if (order.paymentMethod !== "Razorpay" || order.orderStatus === "Cancelled") return 0;
  if (order.paymentStatus === "Paid") return money(order.totalAmount);
  if (order.paymentStatus === "Partially Refunded" && order.refund?.amount > 0) return money(Math.max(0, order.totalAmount - order.refund.amount));
  return 0;
};

const loadReport = async (query) => {
  const range = periodFilter(query);
  const [orders, newCustomers, totalCustomers, recent] = await Promise.all([
    Order.find(range.filter).populate("user", "fullName email").sort({ createdAt: -1 }).lean(),
    User.countDocuments(range.filter), User.countDocuments(),
    Order.find().populate("user", "fullName email").sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const totalSales = money(orders.reduce((sum, order) => sum + revenue(order), 0));
  const pendingOrders = orders.filter((o) => ["Pending", "Confirmed", "Processing"].includes(o.orderStatus)).length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0); monthStart.setMonth(monthStart.getMonth()-11);
  const salesOrders = await Order.find({ createdAt: { $gte: monthStart } }).select("totalAmount paymentMethod paymentStatus orderStatus refund createdAt").lean();
  const chart = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(monthStart.getFullYear(), monthStart.getMonth()+i, 1);
    const matching = salesOrders.filter((o) => o.createdAt.getFullYear() === d.getFullYear() && o.createdAt.getMonth() === d.getMonth());
    return { month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }), sales: money(matching.reduce((sum, o) => sum + revenue(o), 0)), orders: matching.length };
  });
  return {
    period: range.period, generatedAt: new Date().toISOString(),
    stats: { totalSales, totalOrders: orders.length, newCustomers, totalCustomers, pendingOrders },
    monthlySales: chart,
    recentOrders: recent.map((o) => ({ id: String(o._id), customer: o.user?.fullName || "Unavailable", date: o.createdAt, amount: money(o.totalAmount), status: o.orderStatus, paymentStatus: o.paymentStatus, refundStatus: o.refund?.status || "Not Required" })),
    orders,
    note: "Sales include paid Razorpay orders. Cancelled and fully refunded orders are excluded; unknown partial refunds are excluded.",
  };
};

const getDashboardStats = async (req, res) => {
  try { const { orders, ...report } = await loadReport(req.query); return res.json(report); }
  catch (e) { console.error("Dashboard:", e); return res.status(e.message.includes("date") || e.message.includes("period") ? 400 : 500).json({ message: e.message.includes("date") || e.message.includes("period") ? e.message : "Unable to load statistics" }); }
};

const csvEscape = (v) => {
  let s = String(v ?? "");
  if (/^[\s]*[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const exportCsv = async (req, res) => {
  try {
    const r = await loadReport(req.query);
    const columns = ["Order ID", "Date", "Customer", "Email", "Amount INR", "Collected Sales INR", "Payment Method", "Payment Status", "Order Status", "Refund Status", "Refund Amount INR", "Refund ID"];
    const lines = [columns.map(csvEscape).join(",")];
    for (const o of r.orders) lines.push([
      o._id, o.createdAt?.toISOString(), o.user?.fullName, o.user?.email,
      money(o.totalAmount), revenue(o), o.paymentMethod, o.paymentStatus, o.orderStatus,
      o.refund?.status || "Not Required", money(o.refund?.amount), o.refund?.razorpayRefundId,
    ].map(csvEscape).join(","));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="loomzi-sales-report.csv"');
    return res.send("\uFEFF" + lines.join("\r\n"));
  } catch (e) { console.error("CSV report:", e); return res.status(400).json({ message: e.message }); }
};

// Dependency-free, paginated PDF report with summary and order rows.
const pdfEscape = (s) => String(s ?? "").replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
const buildPdf = (lines) => {
  const pages = []; const pageSize = 45;
  for (let i=0; i<lines.length; i+=pageSize) pages.push(lines.slice(i,i+pageSize));
  if (!pages.length) pages.push([]);
  const objects = [null]; const add = (x) => { objects.push(x); return objects.length-1; };
  const catalog = add(""); const root = add(""); const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pageIds = [];
  for (const pageLines of pages) {
    const ops = ["BT /F1 9 Tf 40 795 Td 13 TL"];
    for (const line of pageLines) ops.push(`(${pdfEscape(line).slice(0,125)}) Tj T*`);
    ops.push("ET");
    const content = ops.join("\n");
    const stream = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${root} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog] = `<< /Type /Catalog /Pages ${root} 0 R >>`;
  objects[root] = `<< /Type /Pages /Kids [${pageIds.map((n)=>`${n} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let out = "%PDF-1.4\n"; const offsets = [0];
  for (let i=1; i<objects.length; i++) { offsets[i] = Buffer.byteLength(out); out += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i=1; i<objects.length; i++) out += `${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "ascii");
};
const exportPdf = async (req, res) => {
  try {
    const r = await loadReport(req.query);
    const lines = ["LOOMZI - SALES AND ORDER REPORT", `Generated: ${r.generatedAt}`, `Period: ${r.period}`, "", `Total sales (INR): ${r.stats.totalSales.toFixed(2)}`, `Total orders: ${r.stats.totalOrders}`, `New customers: ${r.stats.newCustomers}`, `Pending orders: ${r.stats.pendingOrders}`, "", "Orders (INR)", "ID (last 12)  Date        Amount    Collected   Payment          Order Status", "-".repeat(74)];
    for (const o of r.orders) lines.push(`${String(o._id).slice(-12).padEnd(13)} ${o.createdAt.toISOString().slice(0,10)}  ${money(o.totalAmount).toFixed(2).padStart(8)}  ${revenue(o).toFixed(2).padStart(9)}  ${String(o.paymentStatus).padEnd(15)}  ${o.orderStatus}`);
    lines.push("", "Note: Unknown partial refunds are excluded from sales totals.");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="loomzi-sales-report.pdf"');
    return res.send(buildPdf(lines));
  } catch (e) { console.error("PDF report:", e); return res.status(400).json({ message: e.message }); }
};
module.exports = { getDashboardStats, exportCsv, exportPdf };
