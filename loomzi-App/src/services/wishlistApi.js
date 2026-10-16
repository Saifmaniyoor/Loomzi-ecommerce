
const API_URL = "http://localhost:5000/api/wishlist";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.message || "Something went wrong"
    );
    error.status = response.status;
    throw error;
  }

  return data;
};

export const getWishlist = async () => {
  const response = await fetch(API_URL, {
    method: "GET",
    credentials: "include",
  });

  return handleResponse(response);
};

export const addToWishlist = async (productId) => {
  const response = await fetch(API_URL, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId }),
  });

  return handleResponse(response);
};

export const removeFromWishlist = async (productId) => {
  const response = await fetch(
    `${API_URL}/${productId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  return handleResponse(response);
};
