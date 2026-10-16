
import { useEffect, useState } from "react";
import { FaHeart } from "react-icons/fa";
import { Link } from "react-router-dom";

import ProductCard from "../../components/ProductCard/ProductCard";
import { getWishlist } from "../../services/wishlistApi";

import "./Wishlist.css";

function Wishlist() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadWishlist = async () => {
      try {
        const data = await getWishlist();

        if (active) {
          setProducts(data.products || []);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadWishlist();

    window.addEventListener(
      "loomzi:wishlist-updated",
      loadWishlist
    );

    return () => {
      active = false;
      window.removeEventListener(
        "loomzi:wishlist-updated",
        loadWishlist
      );
    };
  }, []);

  if (loading) {
    return <p>Loading wishlist...</p>;
  }

  return (
    <div className="wishlist-page">
      <div className="wishlist-heading">
        <h1>My Wishlist</h1>
        <p>
          Your favorite Loomzi products, saved in one place.
        </p>
      </div>

      {error && (
        <p className="wishlist-error" role="alert">
          {error}
        </p>
      )}

      {!error && products.length === 0 ? (
        <div className="wishlist-empty">
          <FaHeart />
          <h2>Your wishlist is empty</h2>
          <p>
            Explore our collection and save the products
            you love.
          </p>

          <Link
            to="/products"
            className="wishlist-shop-btn"
          >
            Explore Products
          </Link>
        </div>
      ) : (
        <div className="wishlist-products-grid">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Wishlist;
