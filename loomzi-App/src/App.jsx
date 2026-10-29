import AdminForgotPassword from "./pages/Admin/Login/AdminForgotPassword";
import AdminAccountSettings from "./pages/Admin/Settings/AdminAccountSettings";

import { Routes, Route } from "react-router-dom";

// ===============================
// Customer Pages
// ===============================
import Home from "./pages/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Registration/Register";
import VerifyOtp from "./pages/VerifyOtp/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import VerifyResetOtp from "./pages/VerifyResetOtp/VerifyResetOtp";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import MyOrders from "./pages/MyOrders/MyOrders";
import ProductListing from "./pages/ProductListing/ProductListing";
import ProductDetails from "./pages/ProductDetails/ProductDetails";
import Cart from "./pages/Cart/Cart";
import Checkout from "./pages/Checkout/Checkout";
import Profile from "./pages/Profile/Profile";
import Addresses from "./pages/Addresses/Addresses";
import Wishlist from "./pages/Wishlist/Wishlist";
import AboutUs from "./pages/AboutUs/AboutUs";

// ===============================
// Customer Layout and Protection
// ===============================
import MainLayout from "./components/MainLayout/MainLayout";
import AccountLayout from "./components/AccountLayout/AccountLayout";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

// ===============================
// Admin Pages
// ===============================
import AdminLogin from "./pages/Admin/Login/AdminLogin";
import AdminDashboard from "./pages/Admin/Dashboard/AdminDashboard";
import CustomerManagement from "./pages/Admin/Customers/CustomerManagement";
import OrderManagement from "./pages/Admin/Orders/OrderManagement";
import OfferManagement from './pages/Admin/Offers/OfferManagement';

// ===============================
// Admin Layout and Protection
// ===============================
import AdminLayout from "./components/AdminLayouts/AdminLayout";
import ProtectedAdminRoute from "./components/Admin/ProtectedAdminRoute";

// ===============================
// Category Management
// ===============================
import CategoryManagement from "./pages/Admin/Categories/CategoryManagement";

// ===============================
// Product Management
// ===============================
import ProductManagement from "./pages/Admin/Products/ProductManagement";
import AddProduct from "./pages/Admin/Products/AddProduct";
import OrderSuccess from "./pages/OrderSuccess/OrderSuccess";
import OrderDetails from "./pages/OrderDetails/OrderDetails";

import CouponManagement from "./pages/Admin/Coupons/CouponManagement";
import ShippingManagement from "./pages/Admin/Settings/ShippingManagement";
import CancellationPolicy from "./pages/CancellationPolicy/CancellationPolicy";
import "./App.css";

function App() {
  return (
    <Routes>
      {/* ===================================
          CUSTOMER PAGES - NAVBAR & FOOTER
      =================================== */}
      <Route element={<MainLayout />}>

        <Route path="/" element={<Home />} />

        <Route path="/products" element={<ProductListing />} />

        <Route path="/products/:id" element={<ProductDetails />} />

        <Route path="/about" element={<AboutUs />} />
        <Route path="/cancellation-policy" element={<CancellationPolicy />} />

        {/* Protected Customer Pages */}
        <Route element={<ProtectedRoute />}>
          <Route path="/cart" element={<Cart />} />

          <Route path="/checkout" element={<Checkout />} />

          {/* Shared Customer Account Layout */}
          <Route element={<AccountLayout />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/addresses" element={<Addresses />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/order-success/:orderId" element={<OrderSuccess />} />
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Route>
        </Route>
      </Route>

      {/* ===================================
          CUSTOMER AUTHENTICATION PAGES
      =================================== */}
      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route path="/verify-otp" element={<VerifyOtp />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />

      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ===================================
          ADMIN LOGIN
      =================================== */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />

      {/* ===================================
          PROTECTED ADMIN PAGES
      =================================== */}
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />

          <Route path="customers" element={<CustomerManagement />} />
          <Route path="orders" element={<OrderManagement />} />

          <Route path="categories" element={<CategoryManagement />} />

          <Route path="products" element={<ProductManagement />} />

          <Route path="products/add" element={<AddProduct />} />
          <Route path="coupons" element={<CouponManagement />} />
          <Route path="settings/shipping" element={<ShippingManagement />} />
          <Route path="settings/account" element={<AdminAccountSettings />} />

          <Route path="products/edit/:id" element={<AddProduct />} />
          <Route path="offers" element={<OfferManagement />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
