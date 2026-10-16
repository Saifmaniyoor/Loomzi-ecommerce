
const API_URL = "http://localhost:5000/api/addresses";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

export const getAddresses = async () => {
  const response = await fetch(API_URL, {
    credentials: "include",
  });

  return handleResponse(response);
};

export const addAddress = async (addressData) => {
  const response = await fetch(API_URL, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addressData),
  });

  return handleResponse(response);
};

export const updateAddress = async (id, addressData) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addressData),
  });

  return handleResponse(response);
};

export const deleteAddress = async (id) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  return handleResponse(response);
};

export const setDefaultAddress = async (id) => {
  const response = await fetch(`${API_URL}/${id}/default`, {
    method: "PATCH",
    credentials: "include",
  });

  return handleResponse(response);
};
