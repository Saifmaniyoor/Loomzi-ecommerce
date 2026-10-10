
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  FaEnvelope,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaTruck,
  FaHeart,
} from "react-icons/fa";

import "./Login.css";
import loomziLogo from "./images/loomzi-logo.png";

function Login() {
  const navigate = useNavigate();

  // Show / Hide Password
  const [showPassword, setShowPassword] = useState(false);

  // Login Form Data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // Error, Loading and Success States
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  // =========================
  // Handle Input Changes
  // =========================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // =========================
  // Handle Login
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    // Validate empty fields
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Send login details to backend
      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",

          // Allow browser to receive session cookie
          credentials: "include",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      // Handle backend errors
      if (!response.ok) {
        throw new Error(
          data.message || "Login failed"
        );
      }

      // Login successful
      setSuccess("Login successful!");

      console.log("Login successful:", data.user);

      // Redirect to Loomzi Home page
      navigate("/", { replace: true });

    } catch (err) {
      console.error("Login error:", err);

      setError(
        err.message || "Something went wrong"
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">

      {/* Decorative Background */}
      <div className="login-decoration decoration-left">
        ?
      </div>

      <div className="login-decoration decoration-right">
        ✂
      </div>

      {/* Login Card */}
      <div className="login-card">

        {/* Back */}
        <Link to="/" className="login-back">
          <span>←</span>
          Back
        </Link>

        {/* Logo */}
        <div className="login-logo">
          <img
            src={loomziLogo}
            alt="Loomzi"
          />
        </div>

        {/* Heading */}
        <div className="login-heading">
          <h1>Welcome Back!</h1>

          <p>
            Please enter your details to continue your
            <br />
            creative journey.
          </p>
        </div>

        {/* Login Form */}
        <form
          className="login-form"
          onSubmit={handleSubmit}
        >

          {/* Email */}
          <div className="form-group">

            <label htmlFor="email">
              Email
            </label>

            <div className="input-container">

              <FaEnvelope className="input-icon" />

              <input
                type="email"
                id="email"
                name="email"
                placeholder="saif@gmail.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />

            </div>

          </div>

          {/* Password */}
          <div className="form-group">

            <div className="password-label">

              <label htmlFor="password">
                Password
              </label>

              <Link to="/forgot-password">
                Forgot Password?
              </Link>

            </div>

            <div className="input-container">

              <FaLock className="input-icon" />

              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                autoComplete="current-password"
                required
              />

              {/* Show / Hide Password */}
              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </button>

            </div>

          </div>

          {/* Error Message */}
          {error && (
            <p
              className="login-error"
              role="alert"
              style={{
                color: "#c0392b",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              {error}
            </p>
          )}

          {/* Success Message */}
          {success && (
            <p
              className="login-success"
              role="status"
              style={{
                color: "#25814c",
                fontSize: "13px",
                marginBottom: "12px",
              }}
            >
              {success}
            </p>
          )}

          {/* Login Button */}
          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

        </form>

        {/* Register */}
        <div className="register-text">

          <span>
            Don't have an account?
          </span>

          <Link to="/register">
            Register
          </Link>

        </div>

      </div>

      {/* Bottom Features */}
      <div className="login-features">

        <div className="feature-item">
          <FaShieldAlt />
          <span>SECURE PAYMENT</span>
        </div>

        <div className="feature-item">
          <FaTruck />
          <span>FAST SHIPPING</span>
        </div>

        <div className="feature-item">
          <FaHeart />
          <span>HAND-MADE</span>
        </div>

      </div>

    </main>
  );
}

export default Login;
