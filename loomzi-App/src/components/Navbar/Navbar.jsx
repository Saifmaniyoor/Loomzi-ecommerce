
import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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

  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const closeMenu = () => {
    setMenuOpen(false);
    setDropdownOpen(false);
  };

  // Fetch logged-in user
  useEffect(() => {
    let cancelled = false;

    const fetchUser = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/me",
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (!cancelled) setUser(null);
          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Fetch user error:", error);

        if (!cancelled) setUser(null);
      }
    };

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  // Logout function
  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      setDropdownOpen(false);
      setMenuOpen(false);

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

        <Link to="/dresses" onClick={closeMenu}>
          Dresses
        </Link>

        <Link to="/hairbands" onClick={closeMenu}>
          Hairbands
        </Link>

        <Link to="/crafts" onClick={closeMenu}>
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
          <input
            type="text"
            placeholder="Search items..."
          />

          <button
            type="button"
            className="search-button"
            aria-label="Search"
          >
            <img src={searchIcon} alt="" />
          </button>
        </div>

        {/* Cart */}
        <Link
          to="/cart"
          className="navbar-icon"
          aria-label="Cart"
        >
          <img src={cartIcon} alt="Cart" />
        </Link>

        {/* Account */}
        <div
          className="navbar-account-wrapper"
          ref={dropdownRef}
        >
          {user ? (
            <>
              <button
                type="button"
                className="navbar-icon navbar-account"
                onClick={() =>
                  setDropdownOpen(!dropdownOpen)
                }
                aria-expanded={dropdownOpen}
                aria-label="Account menu"
              >
                <img src={accountIcon} alt="" />

                <span className="navbar-username">
                  {user.fullName}
                </span>

                <span className="account-arrow">
                  ▾
                </span>
              </button>

              {dropdownOpen && (
                <div className="account-dropdown">

                  <div className="dropdown-user">
                    <strong>{user.fullName}</strong>
                    <small>{user.email}</small>
                  </div>

                  <div className="dropdown-divider" />

                  {/* Profile and Orders pages are coming later */}
                  <button
                    type="button"
                    className="dropdown-item"
                    disabled
                  >
                    My Profile (Coming Soon)
                  </button>

                  <button
                    type="button"
                    className="dropdown-item"
                    disabled
                  >
                    My Orders (Coming Soon)
                  </button>

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
            <Link
              to="/login"
              className="navbar-icon"
              aria-label="Login"
            >
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

          <Link to="/dresses" onClick={closeMenu}>
            Dresses
          </Link>

          <Link to="/hairbands" onClick={closeMenu}>
            Hairbands
          </Link>

          <Link to="/crafts" onClick={closeMenu}>
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
