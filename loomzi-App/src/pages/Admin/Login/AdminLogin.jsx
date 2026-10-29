
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { useAdminAuth } from "../../../Context/AdminAuthContext";
import "./AdminLogin.css";

function AdminLogin() {
  const navigate = useNavigate();
  const { checkAdmin } = useAdminAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
  e.preventDefault();

  setError("");
  setLoading(true);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    // Verify session and update AdminAuthContext
    const verified = await checkAdmin();

    if (!verified) {
      throw new Error(
        "Login succeeded, but admin session verification failed."
      );
    }

    // Navigate only after admin state is updated
    navigate("/admin/dashboard", { replace: true });

  } catch (err) {
    setError(err.message || "Something went wrong");
  } finally {
    setLoading(false);
  }
};

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">Loomzi</div>

        <h1>Admin Login</h1>
        <p className="admin-login-subtitle">
          Welcome back! Please sign in to continue.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="admin-identifier">
            Email or Phone Number
          </label>

          <div className="admin-login-input">
            <FaEnvelope />
            <input
              id="admin-identifier"
              type="text"
              placeholder="Enter email or phone number"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <label htmlFor="admin-password">
            Password
          </label>

          <div className="admin-login-input">
            <FaLock />
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="button"
              className="admin-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <Link to="/admin/forgot-password" className="admin-forgot-link">Forgot password?</Link>

          {error && (
            <p className="admin-login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="admin-login-submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <Link to="/" className="admin-back-home">
          Back to Loomzi Store
        </Link>
      </div>
    </main>
  );
}

export default AdminLogin;
