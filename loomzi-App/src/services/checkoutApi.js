
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "/api";

const CHECKOUT_URL = `${API_BASE}/checkout`;

// ======================================
// RESPONSE HANDLER
// ======================================

const handleResponse = async (response) => {
  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        `Request failed (HTTP ${response.status})`
    );
  }

  return data;
};

// ======================================
// CHECKOUT REQUEST BODY
// ======================================

const buildCheckoutBody = ({
  addressId,
  couponCode = "",
  useWallet = false,
}) => {
  if (!addressId) {
    throw new Error(
      "Please select a delivery address"
    );
  }

  const body = {
    addressId,
  };

  const normalizedCoupon = String(
    couponCode || ""
  )
    .trim()
    .toUpperCase();

  if (normalizedCoupon) {
    body.couponCode = normalizedCoupon;
  }

  // Include only when selected to preserve
  // existing Razorpay request hashing.
  if (useWallet === true) {
    body.useWallet = true;
  }

  return body;
};

// ======================================
// COMMON POST REQUEST
// ======================================

const checkoutPost = async (
  path,
  body,
  idempotencyKey
) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] =
      idempotencyKey;
  }

  const response = await fetch(
    `${CHECKOUT_URL}${path}`,
    {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    }
  );

  return handleResponse(response);
};

// ======================================
// CHECKOUT PREVIEW
// ======================================

export const previewCheckout = async ({
  addressId,
  couponCode = "",
}) => {
  const body = buildCheckoutBody({
    addressId,
    couponCode,
  });

  return checkoutPost("/preview", body);
};

// ======================================
// CASH ON DELIVERY
// ======================================

export const placeCODOrder = async ({
  addressId,
  couponCode = "",
  idempotencyKey,
}) => {
  if (!idempotencyKey) {
    throw new Error(
      "Idempotency key is required"
    );
  }

  const body = buildCheckoutBody({
    addressId,
    couponCode,
  });

  return checkoutPost(
    "/cod",
    body,
    idempotencyKey
  );
};

// ======================================
// COD CHECKOUT STATUS
// ======================================

export const getCODCheckoutStatus = async (
  idempotencyKey
) => {
  if (!idempotencyKey) {
    throw new Error(
      "Idempotency key is required"
    );
  }

  const response = await fetch(
    `${CHECKOUT_URL}/cod/status`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Idempotency-Key":
          idempotencyKey,
      },
    }
  );

  return handleResponse(response);
};

// ======================================
// PREPARE ONLINE / WALLET CHECKOUT
// ======================================

export const prepareRazorpayCheckout = (
  body,
  idempotencyKey
) => {
  if (!idempotencyKey) {
    throw new Error(
      "Idempotency key is required"
    );
  }

  return checkoutPost(
    "/prepare",
    buildCheckoutBody(body),
    idempotencyKey
  );
};

// ======================================
// VALIDATE ONLINE / WALLET CHECKOUT
// ======================================

export const validateRazorpayCheckout = (
  body,
  idempotencyKey
) => {
  if (!idempotencyKey) {
    throw new Error(
      "Idempotency key is required"
    );
  }

  return checkoutPost(
    "/validate-payment",
    buildCheckoutBody(body),
    idempotencyKey
  );
};

// ======================================
// CREATE PENDING ORDER
// ======================================

export const createPendingRazorpayOrder = (
  body,
  idempotencyKey
) => {
  if (!idempotencyKey) {
    throw new Error(
      "Idempotency key is required"
    );
  }

  return checkoutPost(
    "/pending-order",
    buildCheckoutBody(body),
    idempotencyKey
  );
};

// ======================================
// CREATE RAZORPAY GATEWAY ORDER
// ======================================

export const createRazorpayPaymentOrder = (
  attemptId,
  orderId
) => {
  if (!attemptId || !orderId) {
    throw new Error(
      "Checkout attempt ID and order ID are required"
    );
  }

  return checkoutPost(
    "/razorpay/order",
    {
      attemptId,
      orderId,
    }
  );
};

// ======================================
// CONFIRM RAZORPAY PAYMENT
// ======================================

export const confirmRazorpayCheckout = async (
  body
) => {
  const response = await fetch(
    `${API_BASE}/payments/confirm`,
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
// CHECK RAZORPAY / SPLIT ORDER STATUS
// ======================================

export const getRazorpayOrderStatus = async (
  orderId
) => {
  if (!orderId) {
    throw new Error(
      "Order ID is required"
    );
  }

  const response = await fetch(
    `${CHECKOUT_URL}/razorpay/status/${encodeURIComponent(
      orderId
    )}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  return handleResponse(response);
};

// ======================================
// RESUME EXISTING RAZORPAY PAYMENT
// ======================================

export const resumeRazorpayPayment = async (
  orderId
) => {
  if (!orderId) {
    throw new Error(
      "Order ID is required"
    );
  }

  const response = await fetch(
    `${API_BASE}/payments/razorpay/resume/${encodeURIComponent(
      orderId
    )}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  return handleResponse(response);
};
