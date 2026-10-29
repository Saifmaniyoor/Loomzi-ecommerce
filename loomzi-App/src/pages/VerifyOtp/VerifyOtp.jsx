
import { useEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import "./VerifyOtp.css";

function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get registered email from Register.jsx
  const email = location.state?.email || "";

  // Six OTP input boxes
  const [otp, setOtp] = useState([
    "", "", "", "", "", ""
  ]);

  const [resendAvailableAt, setResendAvailableAt] = useState(() => {
    const key = `loomzi-otp-resend:${email.trim().toLowerCase()}`;
    const stored = sessionStorage.getItem(key);
    const initial = location.state?.resendAvailableAt || stored;
    return initial ? new Date(initial).getTime() : Date.now() + 5 * 60 * 1000;
  });
  const [now, setNow] = useState(Date.now());
  const [resending, setResending] = useState(false);
  const secondsLeft = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));
  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!email) return;
    sessionStorage.setItem(`loomzi-otp-resend:${email.trim().toLowerCase()}`, new Date(resendAvailableAt).toISOString());
  }, [email, resendAvailableAt]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResendOtp = async () => {
    if (!email || secondsLeft > 0 || resending || message) return;
    setResending(true);
    setError("");
    try {
      const response = await fetch("http://localhost:5000/api/auth/resend-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      if (data.resendAvailableAt) setResendAvailableAt(new Date(data.resendAvailableAt).getTime());
      if (!response.ok) throw new Error(data.message || "Unable to resend OTP");
      setOtp(["", "", "", "", "", ""]);
      setMessage("");
      setError("");
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || "Unable to resend OTP");
    } finally {
      setResending(false);
    }
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // References to OTP input boxes
  const inputRefs = useRef([]);

  // =========================
  // Handle OTP Input
  // =========================
  const handleChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;

    setOtp(newOtp);
    setError("");

    // Automatically focus next box
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // =========================
  // Handle Backspace
  // =========================
  const handleKeyDown = (index, e) => {
    if (
      e.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // =========================
  // Handle OTP Paste
  // =========================
  const handlePaste = (e) => {
    e.preventDefault();

    const pastedOtp = e.clipboardData
      .getData("text")
      .trim();

    if (!/^\d{6}$/.test(pastedOtp)) {
      setError("Please paste a valid 6-digit OTP");
      return;
    }

    setOtp(pastedOtp.split(""));
    setError("");

    inputRefs.current[5]?.focus();
  };

  // =========================
  // Redirect to Login Page
  // =========================
  const redirectToLogin = () => {
    setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1500);
  };

  // =========================
  // Verify OTP with Backend
  // =========================
  const handleVerify = async (e) => {
    e.preventDefault();

    if (loading || message) return;

    const enteredOtp = otp.join("");

    // Check OTP length
    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    // Check registered email
    if (!email) {
      setError(
        "Registered email not found. Please register again."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      // Send OTP to Express backend
      const response = await fetch(
        "http://localhost:5000/api/auth/verify-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            otp: enteredOtp,
          }),
        }
      );

      const data = await response.json();

      // Handle already verified email
      if (
        data.message === "Email already verified" ||
        data.alreadyVerified === true
      ) {
        setMessage(
          "Email already verified! Redirecting to login..."
        );

        redirectToLogin();
        return;
      }

      // Handle other backend errors
      if (!response.ok) {
        throw new Error(
          data.message || "OTP verification failed"
        );
      }

      // Verification successful
      setMessage(
        "Email verified successfully! Redirecting to login..."
      );

      console.log("OTP verification successful");

      // Redirect to login page
      redirectToLogin();

    } catch (err) {
      console.error("OTP verification error:", err);

      setError(
        err.message || "Something went wrong"
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-page">
      <div className="verify-card">

        {/* Logo */}
        <div className="verify-logo">
          Loomzi
        </div>

        {/* Email Icon */}
        <div className="verify-icon">
          ✉
        </div>

        {/* Heading */}
        <h2>Verify Your Email</h2>

        <p className="verify-description">
          We have sent a 6-digit verification code to
        </p>

        <p className="verify-email">
          {email || "your registered email"}
        </p>

        {/* OTP Form */}
        <form onSubmit={handleVerify}>

          <div className="otp-container">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                autoComplete={
                  index === 0 ? "one-time-code" : "off"
                }
                value={digit}
                onChange={(e) =>
                  handleChange(index, e.target.value)
                }
                onKeyDown={(e) =>
                  handleKeyDown(index, e)
                }
                onPaste={handlePaste}
                className="otp-input"
                aria-label={`OTP digit ${index + 1}`}
                disabled={loading || Boolean(message)}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <p
              className="verify-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Success Message */}
          {message && (
            <p
              className="verify-success"
              role="status"
            >
              {message}
            </p>
          )}

          {/* Verify Button */}
          <button
            type="submit"
            className="verify-button"
            disabled={loading || Boolean(message)}
          >
            {loading
              ? "Verifying..."
              : message
              ? "Redirecting..."
              : "Verify OTP"}
          </button>

        </form>

        {/* OTP Expiry Information */}
        <p className="verify-expiry">
          Your OTP is valid for 5 minutes.
        </p>

        <p className="verify-footer">
          Didn't receive the code?{" "}
          <button type="button" className="resend-placeholder"
            disabled={secondsLeft > 0 || resending || Boolean(message)}
            onClick={handleResendOtp}>
            {resending ? "Sending..." : secondsLeft > 0
              ? `Resend OTP (${formatTime(secondsLeft)})` : "Resend OTP"}
          </button>
        </p>

        {/* Back to Registration */}
        <button
          type="button"
          className="verify-back"
          onClick={() => navigate("/register")}
        >
          ← Back to Registration
        </button>

      </div>
    </div>
  );
}

export default VerifyOtp;
