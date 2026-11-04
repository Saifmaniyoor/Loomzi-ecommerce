import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AdminAuthProvider } from "./Context/AdminAuthContext";

import "./index.css";
import App from "./App.jsx";
import DialogProvider from "./components/Dialog/DialogProvider.jsx";
import "./responsive.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <DialogProvider>
      <AdminAuthProvider>
        <App />
      </AdminAuthProvider>
      </DialogProvider>
    </BrowserRouter>
  </StrictMode>
);
