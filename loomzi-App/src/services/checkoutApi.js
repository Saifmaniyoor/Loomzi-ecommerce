
const API_URL = "http://localhost:5000/api/checkout";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Something went wrong"
    );
  }

  return data;
};

// ======================================
// Checkout Preview
// ======================================
export const previewCheckout = async ({
  addressId,
  couponCode = "",
}) => {
  const body = {
    addressId,
  };

  // Include coupon only when provided.
  if (couponCode.trim()) {
    body.couponCode = couponCode.trim().toUpperCase();
  }

  const response = await fetch(
    `${API_URL}/preview`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  return handleResponse(response);
};


// ======================================
// Place COD Order
// ======================================
export const placeCODOrder = async ({
  addressId,
  couponCode = "",
  idempotencyKey,
}) => {
  if (!idempotencyKey) {
    throw new Error("Idempotency key is required");
  }

  const body = {
    addressId,
  };

  if (couponCode.trim()) {
    body.couponCode = couponCode.trim().toUpperCase();
  }

  const response = await fetch(`${API_URL}/cod`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  return handleResponse(response);
};


  // ======================================
  // Check COD Checkout Status
  // ======================================
  export const getCODCheckoutStatus = async (idempotencyKey) => {
    if (!idempotencyKey) {
      throw new Error("Idempotency key is required");
    }

    const response = await fetch(`${API_URL}/cod/status`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    });

    return handleResponse(response);
  };


const paymentAPI = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const paymentPost = async (path, body, key) => {
  const response = await fetch(`${paymentAPI}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
};
export const prepareRazorpayCheckout = (body, key) => paymentPost("/checkout/prepare", body, key);
export const validateRazorpayCheckout = (body, key) => paymentPost("/checkout/validate-payment", body, key);
export const createPendingRazorpayOrder = (body, key) => paymentPost("/checkout/pending-order", body, key);
export const createRazorpayPaymentOrder = (attemptId, orderId) => paymentPost("/checkout/razorpay/order", { attemptId, orderId });
export const confirmRazorpayCheckout = (body) => paymentPost("/payments/confirm", body);
export const getRazorpayOrderStatus = async (orderId) => {
  const response = await fetch(`${paymentAPI}/checkout/razorpay/status/${encodeURIComponent(orderId)}`, { credentials: "include" });
  return handleResponse(response);
};



export const resumeRazorpayPayment = async (orderId) => {
  const response = await fetch(
    `http://localhost:5000/api/payments/razorpay/resume/${encodeURIComponent(orderId)}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      `Payment continuation failed (HTTP ${response.status})`
    );
  }

  return data;
};


