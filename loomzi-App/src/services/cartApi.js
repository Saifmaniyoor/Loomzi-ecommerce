
const API_URL = "http://localhost:5000/api/cart";

// GET - Fetch customer's cart
export const getCart = async () => {
  const response = await fetch(API_URL, {
    method: "GET",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch cart");
  }

  return data;
};

// POST - Add product to cart
export const addToCart = async (
  productId,
  variantId = null,
  quantity = 1
) => {
  const response = await fetch(`${API_URL}/items`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId,
      variantId,
      quantity,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to add product");
  }

  return data;
};

// PATCH - Update item quantity
export const updateCartQuantity = async (
  itemId,
  quantity
) => {
  const response = await fetch(`${API_URL}/items/${itemId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ quantity }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update quantity");
  }

  return data;
};

// DELETE - Remove one item
export const removeCartItem = async (itemId) => {
  const response = await fetch(`${API_URL}/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to remove item");
  }

  return data;
};

// DELETE - Clear entire cart
export const clearCart = async () => {
  const response = await fetch(API_URL, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to clear cart");
  }

  return data;
};
