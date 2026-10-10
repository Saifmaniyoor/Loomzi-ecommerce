
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  FaQuestionCircle,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaTruck,
  FaHeart,
} from "react-icons/fa";

import "./ResetPassword.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  // Received after successful OTP verification
  const email = location.state?.email;
  const resetToken = location.state?.resetToken;

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const { newPassword, confirmPassword } = formData;

    if (!email || !resetToken) {
      setError("Reset session missing. Please request a new OTP.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must contain at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            resetToken,
            newPassword,
            confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Password reset failed"
        );
      }

      // Redirect to Login page
      navigate("/login", {
        replace: true,
        state: {
          message: "Password reset successful. Please log in.",
        },
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
    <main className="reset-password-page">
      <div className="reset-password-content">

        <div className="reset-password-card">

          <Link
            to="/forgot-password"
            className="reset-password-back"
          >
            ← Back
          </Link>

          <div className="reset-password-icon">
            <FaQuestionCircle />
          </div>

          <h1>Set New Password</h1>

          <p className="reset-password-description">
            Your new password must be different from
            previously used passwords.
          </p>

          <form onSubmit={handleSubmit}>

            {/* New Password */}
            <div className="reset-password-group">
              <label htmlFor="newPassword">
                New Password
              </label>

              <div className="reset-password-input">
                <FaLock className="reset-password-field-icon" />

                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  placeholder="Password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="reset-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="reset-password-group">
              <label htmlFor="confirmPassword">
                Confirm New Password
              </label>

              <div className="reset-password-input">
                <FaLock className="reset-password-field-icon" />

                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="button"
                  className="reset-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && (
              <p className="reset-password-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="reset-password-submit"
              disabled={loading || !email || !resetToken}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>

          </form>
        </div>

        <div className="reset-password-features">
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

export default ResetPassword;
