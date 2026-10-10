
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaQuestionCircle,
  FaShieldAlt,
  FaTruck,
  FaHeart,
} from "react-icons/fa";

import "./VerifyResetOtp.css";

function VerifyResetOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || "";
  const inputRefs = useRef([]);

  const [otp, setOtp] = useState(Array(6).fill(""));
  const [seconds, setSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  // Redirect if user arrived without an email
  useEffect(() => {
    if (!email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate]);

  // Resend countdown
  useEffect(() => {
    if (seconds <= 0) return;

    const timer = setTimeout(() => {
      setSeconds((previous) => previous - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds]);

  // Handle OTP digit entry
  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);

    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Backspace navigation
  const handleKeyDown = (index, event) => {
    if (
      event.key === "Backspace" &&
      !otp[index] &&
      index > 0
    ) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Paste a six-digit OTP
  const handlePaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    const newOtp = Array(6).fill("");

    pasted.split("").forEach((digit, index) => {
      newOtp[index] = digit;
    });

    setOtp(newOtp);
    setError("");

    inputRefs.current[
      Math.min(pasted.length, 5)
    ]?.focus();
  };

  // Verify OTP
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    const enteredOtp = otp.join("");

    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/verify-reset-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            otp: enteredOtp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "OTP verification failed"
        );
      }

      // Reset token is required to change the password
      navigate("/reset-password", {
        replace: true,
        state: {
          email,
          resetToken: data.resetToken,
        },
      });

    } catch (err) {
      setError(err.message || "Unable to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (seconds > 0 || resending) return;

    setResending(true);
    setError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to resend OTP"
        );
      }

      setOtp(Array(6).fill(""));
      setSeconds(60);
      inputRefs.current[0]?.focus();

    } catch (err) {
      setError(err.message || "Unable to resend OTP");
    } finally {
      setResending(false);
    }
  };

  const formattedTime = `00:${String(seconds).padStart(2, "0")}`;

  return (
    <main className="reset-otp-page">
      <div className="reset-otp-content">
        <div className="reset-otp-card">

          <Link
            to="/forgot-password"
            className="reset-otp-back"
          >
            ← Back
          </Link>

          <div className="reset-otp-icon">
            <FaQuestionCircle />
          </div>

          <h1>Verify OTP</h1>

          <p className="reset-otp-description">
            We have sent a 6-digit verification code to
            your email address
            <strong>{email}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <div
              className="reset-otp-inputs"
              onPaste={handlePaste}
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={
                    index === 0 ? "one-time-code" : "off"
                  }
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleChange(index, e.target.value)
                  }
                  onKeyDown={(e) =>
                    handleKeyDown(index, e)
                  }
                  aria-label={`OTP digit ${index + 1}`}
                />
              ))}
            </div>

            {error && (
              <p className="reset-otp-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="reset-otp-submit"
              disabled={loading}
            >
              {loading
                ? "Verifying..."
                : "Verify & Proceed"}
            </button>
          </form>

          <div className="reset-otp-resend">
            <span>Didn't receive the code? </span>

            <button
              type="button"
              onClick={handleResend}
              disabled={seconds > 0 || resending}
            >
              {resending
                ? "Sending..."
                : seconds > 0
                  ? `Resend in ${formattedTime}`
                  : "Resend OTP"}
            </button>
          </div>
        </div>

        <div className="reset-otp-features">
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

export default VerifyResetOtp;
