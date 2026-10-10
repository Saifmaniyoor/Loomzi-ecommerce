import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AdminAuthContext = createContext(null);

const API_URL = "http://localhost:5000";

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAdmin = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/dashboard`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        setAdmin(null);
        return false;
      }

      const data = await response.json();

      setAdmin({
        id: data.adminId,
        fullName: data.fullName,
        email: data.email,
        role: data.role,
      });

      return true;
    } catch (error) {
      console.error("Admin authentication error:", error);
      setAdmin(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdmin();
  }, []);

  const logoutAdmin = async () => {
    const response = await fetch(`${API_URL}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Admin logout failed");
    }

    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        loading,
        checkAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error(
      "useAdminAuth must be used inside AdminAuthProvider"
    );
  }

  return context;
}