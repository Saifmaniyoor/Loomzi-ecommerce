
const API_URL = "http://localhost:5000/api/orders";

export const getOrderById = async (orderId) => {
  const response = await fetch(
    `${API_URL}/${encodeURIComponent(orderId)}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch order details"
    );
  }

  return data.order;
};


export const getMyOrders = async () => {
  const response = await fetch(
    "http://localhost:5000/api/orders",
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch your orders"
    );
  }

  return data.orders;
};


export const cancelOrder = async (orderId) => {
  const response = await fetch(
    `http://localhost:5000/api/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "PATCH",
      credentials: "include",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to cancel order"
    );
  }

  return data;
};
