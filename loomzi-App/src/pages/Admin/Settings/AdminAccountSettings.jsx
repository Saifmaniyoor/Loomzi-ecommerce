import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../../Context/AdminAuthContext";
import "./AdminAccountSettings.css";
const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
async function request(path, body) {
  const response = await fetch(`${API}/api/admin/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
export default function AdminAccountSettings() {
  const navigate = useNavigate();
  const { admin, clearAdmin } = useAdminAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", newEmail: "", code: "" });
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((v) => ({ ...v, [key]: e.target.value }));
  async function execute(fn) { setMessage(""); setBusy(true); try { await fn(); } catch (err) { setMessage(err.message); } finally { setBusy(false); } }
  function done() { clearAdmin(); navigate("/admin/login", { replace: true }); }
  const changePassword = (e) => { e.preventDefault(); execute(async () => {
    const response = await fetch(`${API}/api/admin/settings/account`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword, confirmPassword: form.confirmPassword }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message); done();
  }); };
  const sendEmail = (e) => { e.preventDefault(); execute(async () => { const data = await request("settings/email/send-otp", { newEmail: form.newEmail, currentPassword: form.currentPassword }); setSent(true); setMessage(data.message); }); };
  const verifyEmail = (e) => { e.preventDefault(); execute(async () => { await request("settings/email/verify-otp", { code: form.code, currentPassword: form.currentPassword }); done(); }); };
  return <div className="admin-account-page"><h1>Account Settings</h1><p>Signed in as: <strong>{admin?.email || "Loading..."}</strong></p>
    <div className="admin-account-grid"><section className="admin-account-card"><h2>Change Password</h2>
      <form onSubmit={changePassword}>
        <label>Current Password<input type="password" required autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} /></label>
        <label>New Password<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} /></label>
        <label>Confirm New Password<input type="password" required minLength={12} autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} /></label>
        <button disabled={busy}>Update Password</button>
      </form></section>
      <section className="admin-account-card"><h2>Change Email</h2>
        <form onSubmit={sent ? verifyEmail : sendEmail}>
          <label>Current Password<input type="password" required autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} /></label>
          {!sent ? <label>New Email<input type="email" required value={form.newEmail} onChange={set("newEmail")} /></label> : <label>OTP sent to {form.newEmail}<input required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.code} onChange={set("code")} /></label>}
          <button disabled={busy}>{sent ? "Verify Email and Save" : "Send Verification OTP"}</button>
          {sent && <button type="button" className="admin-secondary-button" onClick={() => { setSent(false); setForm(v => ({ ...v, code: "" })); }}>Change email / resend OTP</button>}
        </form>
      </section></div>
    {message && <p role="status" className="admin-account-message">{message}</p>}
    <p className="admin-account-note">Changing either credential signs you out of all admin sessions. Log in again with your updated credentials.</p>
  </div>;
}
