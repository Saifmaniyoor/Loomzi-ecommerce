import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaWallet, FaArrowDown, FaArrowUp, FaHistory, FaShoppingBag, FaRedo } from "react-icons/fa";
import "./Wallet.css";

const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value) || 0);
const credit = type => !["purchase_debit", "debit", "wallet_payment"].includes(type);

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/wallet", { credentials: "include", signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load your wallet.");
        return data;
      })
      .then(data => { if (!controller.signal.aborted) setWallet(data); })
      .catch(err => { if (err.name !== "AbortError") setError(err.message || "Unable to load your wallet."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
  return (
    <main className="lw-page">
      <div className="lw-heading"><div><span className="lw-eyebrow">YOUR ACCOUNT</span><h1>My Wallet</h1><p>Keep track of your refunds and wallet activity in one place.</p></div><button type="button" className="lw-refresh" onClick={() => setRefresh(n => n + 1)} disabled={loading}><FaRedo /> Refresh</button></div>
      <section className="lw-balance" aria-label="Wallet balance"><div className="lw-balance-top"><span><FaWallet /> Loomzi Wallet</span><span className="lw-balance-chip">Available balance</span></div><p className="lw-balance-label">Your balance</p><div className="lw-amount" aria-live="polite">{loading ? "Loading…" : money(wallet?.balance)}</div><p className="lw-balance-note">Eligible cancellation refunds credited to your wallet will appear here.</p></section>
      <div className="lw-actions"><Link to="/products" className="lw-action"><FaShoppingBag /><span><strong>Browse products</strong><small>Explore Loomzi collections</small></span><span aria-hidden="true">›</span></Link><Link to="/my-orders" className="lw-action"><FaHistory /><span><strong>My orders</strong><small>View orders and refunds</small></span><span aria-hidden="true">›</span></Link></div>
      <section className="lw-history"><div className="lw-history-head"><div><h2>Transaction history</h2><p>Your latest wallet activity</p></div><span className="lw-count">{transactions.length} transactions</span></div>
        {loading ? <div className="lw-state" role="status">Loading your transactions…</div> : error ? <div className="lw-state lw-error" role="alert"><strong>Could not load wallet</strong><p>{error}</p><button type="button" onClick={() => setRefresh(n => n + 1)}>Try again</button></div> : transactions.length === 0 ? <div className="lw-state"><FaWallet className="lw-empty-icon"/><strong>No transactions yet</strong><p>When an eligible refund is credited, it will appear here.</p></div> : <ul className="lw-transactions">{transactions.map((t, index) => { const isCredit = credit(t.type); return <li key={t.id || t._id || index} className="lw-transaction"><div className={`lw-ticon ${isCredit ? "lw-credit" : "lw-debit"}`}>{isCredit ? <FaArrowDown /> : <FaArrowUp />}</div><div className="lw-tdetail"><strong>{t.description || (isCredit ? "Wallet credit" : "Wallet payment")}</strong><small>{t.createdAt ? new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}</small></div><strong className={`lw-tamount ${isCredit ? "lw-positive" : ""}`}>{isCredit ? "+" : "−"}{money(t.amount)}</strong></li>; })}</ul>}
      </section>
      <p className="lw-disclaimer">Wallet checkout payments are not enabled yet. Please use Razorpay at checkout until the secure wallet payment flow is implemented and tested.</p>
    </main>
  );
}
