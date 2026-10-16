
const API_URL = "http://localhost:5000/api";

export const validateCoupon = async (code) => {
  const response = await fetch(
    `${API_URL}/coupons/validate`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to validate coupon"
    );
  }

  return data;
};
