import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserCircle, LogOut } from "lucide-react";

import { useAdminAuth } from "../../Context/AdminAuthContext";

function AdminHeader() {
  const navigate = useNavigate();

  const { admin, logoutAdmin } = useAdminAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      setError("");

      await logoutAdmin();

      navigate("/admin/login", { replace: true });
    } catch (err) {
      setError(err.message || "Logout failed");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="loomzi-admin-header">
      {/* Search Section */}
      <div className="loomzi-header-search">
        <Search size={19} />

        <input
          type="text"
          placeholder="Search orders, products or customers..."
          aria-label="Search"
          disabled
          title="Search coming soon"
        />
      </div>

      {/* Admin Profile Section */}
      <div className="loomzi-header-profile">
        <div className="loomzi-profile-info">
          <strong>{admin?.fullName || "Admin"}</strong>

          <span>
            {admin?.role === "super_admin"
              ? "Super Admin"
              : "Admin"}
          </span>
        </div>

        <div className="loomzi-profile-avatar">
          <UserCircle size={36} />
        </div>

        {/* Logout Button */}
        <button
          type="button"
          className="loomzi-logout-btn"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <LogOut size={17} />
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      {error && (
        <p className="loomzi-logout-error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}

export default AdminHeader;