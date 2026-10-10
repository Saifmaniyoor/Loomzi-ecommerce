
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaShieldAlt,
  FaHandsHelping,
  FaStar,
} from "react-icons/fa";

import "./Register.css";
import loomziLogo from "./images/loomzi-logo.png";

function Register() {
  const navigate = useNavigate();

  // =========================
  // Form Data
  // =========================
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // =========================
  // Validation Errors
  // =========================
  const [errors, setErrors] = useState({});

  // =========================
  // Loading State
  // =========================
  const [loading, setLoading] = useState(false);

  // =========================
  // Password Visibility
  // =========================
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // =========================
  // Handle Input Change
  // =========================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));

    // Clear error when user types
    setErrors((previousErrors) => ({
      ...previousErrors,
      [name]: "",
      submit: "",
    }));
  };

  // =========================
  // Form Validation
  // =========================
  const validateForm = () => {
    const newErrors = {};

    // Full Name
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Please enter your full name";
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email address";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.email.trim()
      )
    ) {
      newErrors.email = "Please enter a valid email address";
    }

    // Phone Number
    if (!formData.phone.trim()) {
      newErrors.phone = "Please enter your phone number";
    } else if (
      !/^[6-9]\d{9}$/.test(formData.phone.trim())
    ) {
      newErrors.phone =
        "Please enter a valid 10-digit phone number";
    }

    // Password
    if (!formData.password) {
      newErrors.password = "Please enter a password";
    } else if (formData.password.length < 8) {
      newErrors.password =
        "Password must be at least 8 characters";
    }

    // Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword =
        "Please confirm your password";
    } else if (
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    return newErrors;
  };

  // =========================
  // Submit Registration Form
  // =========================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    // Frontend validation
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      // Send registration data to backend
      const response = await fetch(
        "http://localhost:5000/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: formData.fullName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            password: formData.password,
            confirmPassword: formData.confirmPassword,
          }),
        }
      );

      // Convert response to JavaScript object
      const data = await response.json();

      // Handle backend errors
      if (!response.ok) {
        console.error("Registration failed:", data.message);

        setErrors({
          submit: data.message || "Registration failed",
        });

        return;
      }

      // Registration successful
      console.log("Registration successful:", data.message);

      // Navigate to OTP verification page
      navigate("/verify-otp", {
        state: {
          email: formData.email.trim().toLowerCase(),
        },
      });

    } catch (error) {
      console.error("Registration error:", error);

      setErrors({
        submit:
          "Unable to connect to the server. Please try again.",
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="register-page">

      {/* =========================
          Background Decorations
      ========================= */}

      <div className="register-cloud"></div>

      <div className="register-question">
        ?
      </div>

      <div className="register-palette">
        ●
      </div>

      {/* =========================
          Registration Card
      ========================= */}

      <div className="register-card">

        {/* Back */}
        <Link
          to="/"
          className="register-back"
        >
          <span>←</span>
          Back
        </Link>

        {/* Logo */}
        <div className="register-logo">
          <img
            src={loomziLogo}
            alt="Loomzi"
          />
        </div>

        {/* Heading */}
        <div className="register-heading">
          <h1>Join Our Creative Family</h1>

          <p>
            Every masterpiece begins with a single stitch.
          </p>
        </div>

        {/* =========================
            Registration Form
        ========================= */}

        <form
          className="register-form"
          onSubmit={handleSubmit}
          noValidate
        >

          {/* Backend Error */}
          {errors.submit && (
            <p className="register-error" role="alert">
              {errors.submit}
            </p>
          )}

          {/* =========================
              Full Name
          ========================= */}

          <div className="register-form-group">
            <label htmlFor="fullName">
              FULL NAME
            </label>

            <div
              className={`register-input-container ${
                errors.fullName ? "input-error" : ""
              }`}
            >
              <FaUser className="register-input-icon" />

              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Jane Doe"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
              />
            </div>

            {errors.fullName && (
              <p className="register-error">
                {errors.fullName}
              </p>
            )}
          </div>

          {/* =========================
              Email
          ========================= */}

          <div className="register-form-group">
            <label htmlFor="email">
              EMAIL ADDRESS
            </label>

            <div
              className={`register-input-container ${
                errors.email ? "input-error" : ""
              }`}
            >
              <FaEnvelope className="register-input-icon" />

              <input
                type="email"
                id="email"
                name="email"
                placeholder="jane@littlestitches.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </div>

            {errors.email && (
              <p className="register-error">
                {errors.email}
              </p>
            )}
          </div>

          {/* =========================
              Phone Number
          ========================= */}

          <div className="register-form-group">
            <label htmlFor="phone">
              PHONE NUMBER
            </label>

            <div
              className={`register-input-container ${
                errors.phone ? "input-error" : ""
              }`}
            >
              <FaPhone className="register-input-icon" />

              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="9876543210"
                value={formData.phone}
                onChange={handleChange}
                maxLength={10}
                autoComplete="tel"
              />
            </div>

            {errors.phone && (
              <p className="register-error">
                {errors.phone}
              </p>
            )}
          </div>

          {/* =========================
              Password
          ========================= */}

          <div className="register-form-group">
            <label htmlFor="password">
              PASSWORD
            </label>

            <div
              className={`register-input-container ${
                errors.password ? "input-error" : ""
              }`}
            >
              <FaLock className="register-input-icon" />

              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
              />

              <button
                type="button"
                className="register-password-toggle"
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

            {errors.password && (
              <p className="register-error">
                {errors.password}
              </p>
            )}
          </div>

          {/* =========================
              Confirm Password
          ========================= */}

          <div className="register-form-group">
            <label htmlFor="confirmPassword">
              CONFIRM PASSWORD
            </label>

            <div
              className={`register-input-container ${
                errors.confirmPassword ? "input-error" : ""
              }`}
            >
              <FaLock className="register-input-icon" />

              <input
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                id="confirmPassword"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
              />

              <button
                type="button"
                className="register-password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    !showConfirmPassword
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <FaEyeSlash />
                ) : (
                  <FaEye />
                )}
              </button>
            </div>

            {errors.confirmPassword && (
              <p className="register-error">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* =========================
              Create Account Button
          ========================= */}

          <button
            type="submit"
            className="register-button"
            disabled={loading}
          >
            {loading
              ? "Creating Account..."
              : "Create Account"}
          </button>
        </form>

        {/* =========================
            Login Link
        ========================= */}

        <div className="register-login">
          <span>
            Already have an account?
          </span>

          <Link to="/login">
            Login
          </Link>
        </div>
      </div>

      {/* =========================
          Bottom Features
      ========================= */}

      <div className="register-features">

        <div className="register-feature">
          <FaShieldAlt />
          <span>ENCRYPTED DATA</span>
        </div>

        <div className="register-feature">
          <FaHandsHelping />
          <span>COMMUNITY SUPPORT</span>
        </div>

        <div className="register-feature">
          <FaStar />
          <span>PREMIUM CRAFTS</span>
        </div>

      </div>
    </main>
  );
}

export default Register;
