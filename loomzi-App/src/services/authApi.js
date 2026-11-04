
const API_URL = "/api/auth";

// ======================================
// Get Current Logged-in User
// ======================================
export const getCurrentUser = async () => {
  const response = await fetch(`${API_URL}/me`, {
    method: "GET",
    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch current user"
    );
  }

  if (!data.user?.id) {
    throw new Error("Current user ID not found");
  }

  return data.user;
};
