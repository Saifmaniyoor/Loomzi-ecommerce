import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getCart } from "../../services/cartApi";

import "./Navbar.css";

import loomziLogo from "./images/loomzi-logo.png";
import searchIcon from "./images/search.png";
import cartIcon from "./images/cart.png";
import accountIcon from "./images/account.png";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Cart notification
  const [cartCount, setCartCount] = useState(0);

  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const closeMenu = () => {
    setMenuOpen(false);
    setDropdownOpen(false);
  };

  // ===============================
  // 1. Fetch Logged-in Customer
  // ===============================
  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/auth/me", {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setUser(null);
            setCartCount(0);
          }
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Fetch user error:", error);

        if (!cancelled) {
          setUser(null);
          setCartCount(0);
        }
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // ===============================
  // 2. Fetch Cart Quantity
  // ===============================
  const fetchCartCount = useCallback(async () => {
    try {
      const data = await getCart();

      const items = data.cart?.items || [];

      const totalQuantity = items.reduce(
        (total, item) => total + Number(item.quantity || 0),
        0,
      );

      setCartCount(totalQuantity);
    } catch (error) {
      // For guests or expired sessions, hide the cart count.
      setCartCount(0);
    }
  }, []);

  // Refresh when route changes or cart is updated
  useEffect(() => {
    fetchCartCount();

    window.addEventListener("loomzi:cart-updated", fetchCartCount);

    return () => {
      window.removeEventListener("loomzi:cart-updated", fetchCartCount);
    };
  }, [fetchCartCount, location.pathname]);

  // ===============================
  // 3. Close Dropdown Outside
  // ===============================
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // ===============================
  // 4. Logout
  // ===============================
  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("http://localhost:5000/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      setCartCount(0);
      setDropdownOpen(false);
      setMenuOpen(false);

      window.dispatchEvent(new Event("loomzi:cart-updated"));

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to logout. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="navbar">
      {/* Logo */}
      <div className="navbar-logo">
        <Link to="/" onClick={closeMenu}>
          <img src={loomziLogo} alt="Loomzi" />
        </Link>
      </div>

      {/* Desktop Menu */}
      <nav className="navbar-menu">
        <Link to="/" onClick={closeMenu}>
          Home
        </Link>

        <Link to="/products" onClick={closeMenu}>
          Shop
        </Link>

        <Link to="/products?category=Dresses" onClick={closeMenu}>
          Dresses
        </Link>

        <Link to="/products?category=Hairbands" onClick={closeMenu}>
          Hairbands
        </Link>

        <Link to="/products?category=Crafts" onClick={closeMenu}>
          Crafts
        </Link>

        <Link to="/about" onClick={closeMenu}>
          About Us
        </Link>
      </nav>

      {/* Right Side */}
      <div className="navbar-actions">
        {/* Search */}
        <div className="navbar-search">
          <input type="text" placeholder="Search items..." />

          <button type="button" className="search-button" aria-label="Search">
            <img src={searchIcon} alt="" />
          </button>
        </div>

        {/* Cart with Notification Badge */}
        <Link
          to="/cart"
          className="navbar-icon navbar-cart"
          aria-label={`Cart with ${cartCount} items`}
          onClick={closeMenu}
        >
          <img src={cartIcon} alt="" />

          {cartCount > 0 && (
            <span className="navbar-cart-badge">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>

        {/* Account */}
        <div className="navbar-account-wrapper" ref={dropdownRef}>
          {user ? (
            <>
              <button
                type="button"
                className="navbar-icon navbar-account"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-label="Account menu"
              >
                <img src={accountIcon} alt="" />

                <span className="navbar-username">{user.fullName}</span>

                <span className="account-arrow">▾</span>
              </button>

              {dropdownOpen && (
                <div className="account-dropdown">
                  <div className="dropdown-user">
                    <strong>{user.fullName}</strong>
                    <small>{user.email}</small>
                  </div>

                  <div className="dropdown-divider" />

                  <Link
                    to="/profile"
                    className="dropdown-item"
                    onClick={closeMenu}
                  >
                    My Profile
                  </Link>

                  <Link
                    to="/my-orders"
                    className="dropdown-item"
                    onClick={closeMenu}
                  >
                    My Orders
                  </Link>

                  <div className="dropdown-divider" />

                  <button
                    type="button"
                    className="dropdown-item dropdown-logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Logging out..." : "Logout"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link to="/login" className="navbar-icon" aria-label="Login">
              <img src={accountIcon} alt="Account" />
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="mobile-menu">
          <Link to="/" onClick={closeMenu}>
            Home
          </Link>

          <Link to="/products" onClick={closeMenu}>
            Shop
          </Link>

          <Link to="/products?category=Dresses" onClick={closeMenu}>
            Dresses
          </Link>

          <Link to="/products?category=Hairbands" onClick={closeMenu}>
            Hairbands
          </Link>

          <Link to="/products?category=Crafts" onClick={closeMenu}>
            Crafts
          </Link>

          <Link to="/about" onClick={closeMenu}>
            About Us
          </Link>
        </nav>
      )}
    </header>
  );
}

export default Navbar;
