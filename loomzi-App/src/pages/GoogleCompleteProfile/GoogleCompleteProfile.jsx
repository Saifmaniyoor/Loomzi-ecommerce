import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./GoogleCompleteProfile.css";

export default function GoogleCompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) { setError("Enter a valid 10-digit Indian mobile number"); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/google/complete-profile", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to complete registration");
      window.location.assign("/");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <main className="loomzi-complete-page"><section className="loomzi-complete-card">
    <Link to="/login">← Back to login</Link>
    <h1>Complete your Loomzi profile</h1>
    <p>Welcome{location.state?.fullName ? `, ${location.state.fullName}` : ""}! Please enter your phone number to finish signing up.</p>
    {location.state?.email && <p className="loomzi-complete-email">{location.state.email}</p>}
    <form onSubmit={submit}>
      <label htmlFor="google-phone">Mobile number</label>
      <input id="google-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10}
        placeholder="10-digit mobile number" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,""))} required />
      {error && <p role="alert" className="loomzi-complete-error">{error}</p>}
      <button disabled={busy} type="submit">{busy ? "Saving..." : "Complete Registration"}</button>
    </form>
  </section></main>;
}
