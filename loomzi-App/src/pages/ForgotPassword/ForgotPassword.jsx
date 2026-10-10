
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaEnvelope,
  FaQuestionCircle,
  FaShieldAlt,
  FaTruck,
  FaHeart,
} from "react-icons/fa";

import "./ForgotPassword.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: normalizedEmail,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to send OTP"
        );
      }

      setSuccess(data.message);

      // Go to the reset OTP verification page
      navigate("/verify-reset-otp", {
        state: { email: normalizedEmail },
      });

    } catch (err) {
      setError(
        err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="forgot-page">
      <div className="forgot-content">

        <div className="forgot-card">

          <div className="forgot-icon-box">
            <FaQuestionCircle />
          </div>

          <h1>Forgot Password?</h1>

          <p className="forgot-description">
            Enter your email address and we'll send you
            an OTP to reset your password.
          </p>

          <form
            className="forgot-form"
            onSubmit={handleSubmit}
          >
            <label htmlFor="forgot-email">
              Email Address
            </label>

            <div className="forgot-input-wrapper">
              <FaEnvelope className="forgot-email-icon" />

              <input
                id="forgot-email"
                type="email"
                placeholder="hello@littlestitches.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                autoComplete="email"
                required
              />
            </div>

            {error && (
              <p className="forgot-error" role="alert">
                {error}
              </p>
            )}

            {success && (
              <p className="forgot-success" role="status">
                {success}
              </p>
            )}

            <button
              type="submit"
              className="forgot-submit"
              disabled={loading}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>

          <p className="forgot-login-text">
            Remember your password?{" "}
            <Link to="/login">
              Back to Login
            </Link>
          </p>

        </div>

        <div className="forgot-features">
          <div>
            <FaShieldAlt />
            <span>SECURE PAYMENT</span>
          </div>

          <div>
            <FaTruck />
            <span>FAST SHIPPING</span>
          </div>

          <div>
            <FaHeart />
            <span>HAND-MADE</span>
          </div>
        </div>

      </div>
    </main>
  );
}

export default ForgotPassword;
