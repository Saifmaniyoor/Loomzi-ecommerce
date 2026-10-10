import { NavLink } from "react-router-dom"; 

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Settings,
  LogOut,
  Store,
} from "lucide-react";

function AdminSidebar({ onLogout, loggingOut }) {
  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/admin/dashboard",
    },
    {
      name: "Product Management",
      icon: Package,
      path: "/admin/products",
    },
    {
      name: "Order Management",
      icon: ShoppingBag,
      path: "/admin/orders",
    },
    {
      name: "Customer Management",
      icon: Users,
      path: "/admin/customers",
    },
    {
      name: "Vendor Management",
      icon: Store,
      path: "/admin/vendors",
    },
  ];

  return (
    <aside className="loomzi-admin-sidebar">
      <div className="loomzi-sidebar-brand">
        <h1>LOOMZI</h1>
        <span>Crafted with a Story</span>
      </div>

      <nav className="loomzi-sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `loomzi-sidebar-link ${
                  isActive ? "active" : ""
                }`
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}

        <p className="loomzi-sidebar-label">SYSTEM</p>

        <NavLink
          to="/admin/settings"
          className="loomzi-sidebar-link"
        >
          <Settings size={19} />
          <span>Settings</span>
        </NavLink>
      </nav>

      <button
        type="button"
        className="loomzi-sidebar-logout"
        onClick={onLogout}
        disabled={loggingOut}
      >
        <LogOut size={19} />
        {loggingOut ? "Logging out..." : "Logout"}
      </button>
    </aside>
  );
}

export default AdminSidebar;
