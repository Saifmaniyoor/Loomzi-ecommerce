import { Routes, Route } from "react-router-dom";

// Customer Pages
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

// Customer Layout and Protection
import MainLayout from "./components/MainLayout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";

// Admin Pages
import AdminLogin from "./pages/Admin/Login/AdminLogin";
import AdminDashboard from "./pages/Admin/Dashboard/AdminDashboard";
import CustomerManagement from "./pages/Admin/Customers/CustomerManagement";

// Admin Layout and Protection
import AdminLayout from "./components/AdminLayouts/AdminLayout";
import ProtectedAdminRoute from "./components/Admin/ProtectedAdminRoute";

import "./App.css";

function App() {
  return (
    <Routes>
      {/* Customer pages with Navbar and Footer */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<ProductListing />} />
        <Route path="/products/:id" element={<ProductDetails />} />
      </Route>

      {/* Customer Authentication */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Customer Pages */}
      <Route element={<ProtectedRoute />}>
        <Route path="/my-orders" element={<MyOrders />} />
      </Route>

      {/* Admin Login */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Admin Pages */}
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="customers" element={<CustomerManagement />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;