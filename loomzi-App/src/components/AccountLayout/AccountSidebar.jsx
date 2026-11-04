import { alertDialog } from "../Dialog/dialogService.js";

import { NavLink, useNavigate } from "react-router-dom";
import {
  FaUser,
  FaMapMarkerAlt,
  FaBox,
  FaHeart,
  FaWallet,
  FaSignOutAlt,
} from "react-icons/fa";

function AccountSidebar({ user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      window.dispatchEvent(
        new Event("loomzi:cart-updated")
      );

      navigate("/login", { replace: true });
    } catch (error) {
      alertDialog(error.message);
    }
  };

  const menuItems = [
    {
      label: "My Profile",
      path: "/profile",
      icon: <FaUser />,
    },
    {
      label: "My Addresses",
      path: "/addresses",
      icon: <FaMapMarkerAlt />,
    },
    {
      label: "My Orders",
      path: "/my-orders",
      icon: <FaBox />,
    },
    {
      label: "My Wallet",
      path: "/wallet",
      icon: <FaWallet />,
    },
    {
      label: "My Wishlist",
      path: "/wishlist",
      icon: <FaHeart />,
    },
  ];

  return (
    <aside className="account-sidebar">
      <div className="account-sidebar-user">
        <div className="account-avatar">
          {user?.fullName?.charAt(0)?.toUpperCase() || "U"}
        </div>

        <h3>{user?.fullName || "Customer"}</h3>
        <p>{user?.email || ""}</p>
      </div>

      <nav className="account-sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `account-nav-item ${isActive ? "active" : ""}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className="account-nav-item account-logout"
          onClick={handleLogout}
        >
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}

export default AccountSidebar;
