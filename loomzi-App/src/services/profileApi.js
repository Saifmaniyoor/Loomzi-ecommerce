
const API_URL = "/api/profile";

const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

export const getProfile = async () => {
  const response = await fetch(API_URL, {
    method: "GET",
    credentials: "include",
  });

  return handleResponse(response);
};

export const updateProfile = async (profileData) => {
  const response = await fetch(API_URL, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profileData),
  });

  return handleResponse(response);
};

export const changePassword = async (passwordData) => {
  const response = await fetch(`${API_URL}/password`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(passwordData),
  });

  return handleResponse(response);
};

export const requestEmailChange = async (payload) => handleResponse(await fetch(`${API_URL}/email/request`, {method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}));
export const verifyEmailChange = async (otp) => handleResponse(await fetch(`${API_URL}/email/verify`, {method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({otp})}));
