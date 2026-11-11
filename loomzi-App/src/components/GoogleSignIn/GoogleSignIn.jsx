import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./GoogleSignIn.css";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let googleScriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { googleScriptPromise = null; reject(new Error("Google sign-in could not load")); };
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleSignIn() {
  const navigate = useNavigate();
  const container = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!CLIENT_ID) { setError("Google sign-in is not configured yet."); return; }
    loadGoogleScript().then(() => {
      if (!active || !container.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          if (!active) return;
          setBusy(true); setError("");
          try {
            const response = await fetch("/api/auth/google", {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Google login failed");
            if (data.needsPhone) navigate("/google-complete-profile", { state: { email: data.email, fullName: data.fullName } });
            else { window.location.assign("/"); }
          } catch (e) { if (active) setError(e.message); }
          finally { if (active) setBusy(false); }
        }
      });
      container.current.replaceChildren();
      window.google.accounts.id.renderButton(container.current, {
        theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 400
      });
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [navigate]);
  return <div className="loomzi-google-signin">
    <div className="loomzi-google-divider"><span>or</span></div>
    <div ref={container} className="loomzi-google-button" />
    {busy && <p role="status">Signing in with Google...</p>}
    {error && <p role="alert" className="loomzi-google-error">{error}</p>}
  </div>;
}
