let handler = null;

export function registerDialogHandler(nextHandler) {
  handler = nextHandler;
  return () => { if (handler === nextHandler) handler = null; };
}

export function showDialog(options) {
  if (!handler) {
    console.error("Loomzi dialog provider is not mounted", options);
    return Promise.resolve(null);
  }
  return handler(options);
}

export async function confirmDialog(message, options = {}) {
  return (await showDialog({
    title: options.title || "Are you sure?",
    message,
    type: options.type || "danger",
    actions: [
      { label: options.cancelText || "Cancel", value: false, style: "secondary" },
      { label: options.confirmText || "Confirm", value: true, style: "danger" },
    ],
  })) === true;
}

export function alertDialog(message, options = {}) {
  return showDialog({
    title: options.title || "Notice",
    message,
    type: options.type || "info",
    actions: [{ label: "OK", value: true, style: "primary" }],
  });
}
