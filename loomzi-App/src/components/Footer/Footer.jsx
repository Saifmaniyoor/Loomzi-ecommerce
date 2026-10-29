import "./Footer.css";

import {
  FaInstagram,
  FaFacebookF,
  FaPinterestP,
} from "react-icons/fa";

import loomziLogo from "./images/loomzi-footer-logo.png";

function Footer() {
  return (
    <footer className="footer">

      {/* Newsletter Section */}
      <div className="footer-newsletter">

        <div className="newsletter-content">
          <p className="footer-subtitle">STAY IN THE LOOP</p>

          <h2>Little things, made with love.</h2>

          <p>
            Sign up for our newsletter and discover new collections,
            handmade stories and special offers.
          </p>
        </div>

        <form className="newsletter-form">
          <input
            type="email"
            placeholder="Enter your email address"
          />

          <button type="submit">
            Subscribe
          </button>
        </form>

      </div>


      {/* Main Footer */}
      <div className="footer-main">

        {/* Brand */}
        <div className="footer-brand">

          <div className="footer-logo">
            <img
              src={loomziLogo}
              alt="Loomzi"
            />
          </div>

          <p>
            Thoughtfully designed fashion and handmade crafts,
            created to bring a little more joy to everyday moments.
          </p>

          {/* Social Media Icons */}
          <div className="footer-socials">

            <a
              href="#"
              aria-label="Instagram"
            >
              <FaInstagram />
            </a>

            <a
              href="#"
              aria-label="Facebook"
            >
              <FaFacebookF />
            </a>

            <a
              href="#"
              aria-label="Pinterest"
            >
              <FaPinterestP />
            </a>

          </div>

        </div>


        {/* Shop */}
        <div className="footer-column">

          <h3>Shop</h3>

          <a href="/products">All Products</a>
          <a href="/products?category=dresses">Dresses</a>
          <a href="/products?category=kids">Kids</a>
          <a href="/products?category=crafts">Handmade Crafts</a>

        </div>


        {/* Help */}
        <div className="footer-column">

          <h3>Help</h3>

          <a href="/contact">Contact Us</a>
          <a href="/shipping">Shipping & Delivery</a>
          <a href="/cancellation-policy">Cancellation &amp; Returns Policy</a>
          <a href="/faq">FAQs</a>

        </div>


        {/* About */}
        <div className="footer-column">

          <h3>About</h3>

          <a href="/about">Our Story</a>
          <a href="/about">About Loomzi</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms & Conditions</a>

        </div>

      </div>


      {/* Bottom Footer */}
      <div className="footer-bottom">

        <p>
          © 2026 Loomzi. All rights reserved.
        </p>

        <p>
          Made with love by Loomzi.
        </p>

      </div>

    </footer>
  );
}

export default Footer;