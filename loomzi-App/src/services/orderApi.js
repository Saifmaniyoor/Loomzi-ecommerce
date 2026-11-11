
const API_URL = "/api/orders";

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
    API_URL,
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


export const cancelOrder = async (orderId, refundMethod = "original") => {
  const response = await fetch(
    `${API_URL}/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refundMethod }),
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

export const downloadOrderInvoice = async (orderId) => {
  const response = await fetch(`${API_URL}/${encodeURIComponent(orderId)}/invoice`, {
    credentials: "include",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Failed to download invoice");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Loomzi-Invoice-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
