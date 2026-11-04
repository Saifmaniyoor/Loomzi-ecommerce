import { useEffect } from "react";
import "./Popup.css";

/** Use for confirmations and messages instead of window.alert/window.confirm. */
export default function Popup({ open, title = "Notice", message, type = "info", confirmText = "OK", cancelText = "Cancel", onConfirm, onClose, showCancel = false }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = event => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="lp-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}><section className="lp-modal" role="alertdialog" aria-modal="true" aria-labelledby="lp-title" aria-describedby="lp-message"><div className={`lp-symbol lp-${type}`}>{type === "success" ? "✓" : type === "error" ? "!" : "i"}</div><h2 id="lp-title">{title}</h2><p id="lp-message">{message}</p><div className="lp-buttons">{showCancel && <button type="button" className="lp-cancel" onClick={onClose}>{cancelText}</button>}<button type="button" className="lp-confirm" onClick={onConfirm || onClose}>{confirmText}</button></div></section></div>;
}
