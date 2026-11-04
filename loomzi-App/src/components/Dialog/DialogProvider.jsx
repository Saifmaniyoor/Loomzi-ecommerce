import { useEffect, useRef, useState } from "react";
import { registerDialogHandler } from "./dialogService";
import "./DialogProvider.css";

export default function DialogProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const queue = useRef([]);
  const active = useRef(null);

  useEffect(() => {
    const unregister = registerDialogHandler((options) => new Promise((resolve) => {
      queue.current.push({ options, resolve });
      if (!active.current) showNext();
    }));
    return () => {
      unregister();
      if (active.current) active.current.resolve(null);
      queue.current.forEach(item => item.resolve(null));
      active.current = null;
      queue.current = [];
    };
  }, []);

  function showNext() {
    const next = queue.current.shift() || null;
    active.current = next;
    setCurrent(next?.options || null);
  }

  function finish(value) {
    if (!active.current) return;
    const previous = active.current;
    active.current = null;
    previous.resolve(value);
    showNext();
  }

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); finish(null); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [current]);

  return <>
    {children}
    {current && <div className="loomzi-dialog-backdrop" role="presentation">
      <section className="loomzi-dialog" role="alertdialog" aria-modal="true" aria-labelledby="loomzi-dialog-title" aria-describedby="loomzi-dialog-description">
        <button type="button" className="loomzi-dialog-close" aria-label="Close dialog" onClick={() => finish(null)}>×</button>
        <span className={`loomzi-dialog-icon loomzi-dialog-icon-${current.type || "info"}`} aria-hidden="true">{current.type === "danger" ? "!" : current.type === "success" ? "✓" : "i"}</span>
        <h2 id="loomzi-dialog-title">{current.title || "Notice"}</h2>
        <p id="loomzi-dialog-description">{current.message}</p>
        <div className="loomzi-dialog-actions">
          {(current.actions || []).map((action, index) => <button key={index} type="button" className={`loomzi-dialog-btn loomzi-dialog-${action.style || "primary"}`} onClick={() => finish(action.value)} autoFocus={index === 0}>{action.label}</button>)}
        </div>
      </section>
    </div>}
  </>;
}
