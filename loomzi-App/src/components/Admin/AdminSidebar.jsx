//CSS file location - admin layout -- admin layout.css

import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Settings,
  Store,
  ChevronDown,
  ChevronRight,
  List,
  PlusCircle,
  FolderTree,
} from "lucide-react";

function AdminSidebar() {
  const location = useLocation();

  const isProductRoute =
    location.pathname === "/admin/products" ||
    location.pathname.startsWith("/admin/products/") ||
    location.pathname === "/admin/categories" ||
    location.pathname.startsWith("/admin/categories/");

  const [productsOpen, setProductsOpen] = useState(isProductRoute);

  const menuItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      path: "/admin/dashboard",
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
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) =>
            `loomzi-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <LayoutDashboard size={19} />
          <span>Dashboard</span>
        </NavLink>

        {/* Expandable Product Management */}
        <button
          type="button"
          className={`loomzi-sidebar-link loomzi-sidebar-toggle ${
            isProductRoute ? "active" : ""
          }`}
          onClick={() => setProductsOpen((previous) => !previous)}
          aria-expanded={productsOpen}
        >
          <Package size={19} />
          <span>Product Management</span>

          {productsOpen ? (
            <ChevronDown size={17} className="loomzi-sidebar-chevron" />
          ) : (
            <ChevronRight size={17} className="loomzi-sidebar-chevron" />
          )}
        </button>

        {productsOpen && (
          <div className="loomzi-sidebar-submenu">
            <NavLink
              to="/admin/products"
              end
              className={({ isActive }) =>
                `loomzi-sidebar-link loomzi-sidebar-sublink ${
                  isActive ? "active" : ""
                }`
              }
            >
              <List size={17} />
              <span>All Products</span>
            </NavLink>

            <NavLink
              to="/admin/products/add"
              className={({ isActive }) =>
                `loomzi-sidebar-link loomzi-sidebar-sublink ${
                  isActive ? "active" : ""
                }`
              }
            >
              <PlusCircle size={17} />
              <span>Add Product</span>
            </NavLink>

            <NavLink
              to="/admin/categories"
              className={({ isActive }) =>
                `loomzi-sidebar-link loomzi-sidebar-sublink ${
                  isActive ? "active" : ""
                }`
              }
            >
              <FolderTree size={17} />
              <span>Categories</span>
            </NavLink>
          </div>
        )}

        {menuItems
          .filter((item) => item.name !== "Dashboard")
          .map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `loomzi-sidebar-link ${isActive ? "active" : ""}`
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
          className={({ isActive }) =>
            `loomzi-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <Settings size={19} />
          <span>Settings</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default AdminSidebar;