//CSS file location - admin layout -- admin layout.css

import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../../Context/AdminAuthContext";

function ProtectedAdminRoute() {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return <p>Checking admin session...</p>;
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedAdminRoute;