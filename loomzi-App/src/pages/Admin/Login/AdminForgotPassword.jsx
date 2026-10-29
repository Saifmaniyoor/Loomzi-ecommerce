import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./AdminLogin.css";
import "../Settings/AdminAccountSettings.css";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
export default function AdminForgotPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);
  const [form, setForm] = useState({ email: "", code: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((v) => ({ ...v, [key]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setMessage(""); setBusy(true);
    const endpoints = ["forgot-password", "verify-reset-otp", "reset-password"];
    const body = stage === 0 ? { email: form.email } : stage === 1 ? { email: form.email, code: form.code } : form;
    try {
      const response = await fetch(`${API}/api/admin/${endpoints[stage]}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");
      if (stage === 2) { navigate("/admin/login", { replace: true }); return; }
      setStage(stage + 1); setMessage(data.message);
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <main className="admin-login-page"><div className="admin-login-card">
    <div className="admin-login-brand">Loomzi</div><h1>Admin Password Recovery</h1>
    <p className="admin-login-subtitle">{["Enter your registered admin email", "Enter the 6-digit OTP sent to your email", "Choose a new admin password"][stage]}</p>
    <form onSubmit={submit}>
      {stage === 0 && <><label htmlFor="recover-email">Admin Email</label><input className="admin-setting-input" id="recover-email" type="email" required autoComplete="email" value={form.email} onChange={set("email")} /></>}
      {stage >= 1 && <><label htmlFor="recover-code">6-digit OTP</label><input className="admin-setting-input" id="recover-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={form.code} onChange={set("code")} /></>}
      {stage === 2 && <><label htmlFor="recover-password">New Password (12+ characters)</label><input className="admin-setting-input" id="recover-password" type="password" minLength={12} maxLength={128} required value={form.newPassword} onChange={set("newPassword")} /><label htmlFor="recover-confirm">Confirm Password</label><input className="admin-setting-input" id="recover-confirm" type="password" minLength={12} required value={form.confirmPassword} onChange={set("confirmPassword")} /></>}
      {message && <p role="status" className="admin-login-subtitle">{message}</p>}
      <button className="admin-login-submit" disabled={busy}>{busy ? "Please wait..." : ["Send OTP", "Verify OTP", "Reset Password"][stage]}</button>
    </form>
    {stage === 1 && <button className="admin-text-button" onClick={() => setStage(0)}>Resend OTP</button>}
    <Link to="/admin/login" className="admin-back-home">Back to Admin Login</Link>
  </div></main>;
}
