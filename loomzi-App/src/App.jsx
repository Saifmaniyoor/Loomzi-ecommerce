import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminDashboard from "./pages/Admin/Dashboard/AdminDashboard";

import Home from "./pages/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Registration/Register";
import VerifyOtp from "./pages/VerifyOtp/VerifyOtp";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import VerifyResetOtp from "./pages/VerifyResetOtp/VerifyResetOtp";
import ResetPassword from "./pages/ResetPassword/ResetPassword";

import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import MyOrders from "./pages/MyOrders/MyOrders";
import ProductListing from "./pages/ProductListing/ProductListing";

import MainLayout from "./components/MainLayout/MainLayout";
import ProductDetails from "./pages/ProductDetails/ProductDetails";
import AdminLogin from "./pages/Admin/Login/AdminLogin";

import CustomerManagement from "./pages/Admin/Customers/CustomerManagement";
import AdminLayout from "./components/AdminLayouts/AdminLayout";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pages with Navbar and Footer */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductListing />} />
          <Route path="/products/:id" element={<ProductDetails />} />
        </Route>

        {/* Authentication pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="customers" element={<CustomerManagement />} />
        </Route>

        {/* Protected pages */}
        <Route element={<ProtectedRoute />}>
          <Route path="/my-orders" element={<MyOrders />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
