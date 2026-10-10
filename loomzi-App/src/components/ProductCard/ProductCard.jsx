import { useState } from "react";
import { FaHeart, FaPlus, FaStar } from "react-icons/fa";
import "./ProductCard.css";
import { Link } from "react-router-dom";

function ProductCard({ product }) {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleAddToCart = () => {
    // We'll connect this to the Cart module later.
    alert(`${product.name} — Cart integration coming soon!`);
  };

  return (
    <article className="loomzi-product-card">
      <div className="loomzi-product-image">
        <Link to={`/products/${product.id}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>

        <button
          type="button"
          className={`loomzi-wishlist ${isFavorite ? "active" : ""}`}
          onClick={() => setIsFavorite(!isFavorite)}
          aria-label={`Toggle wishlist for ${product.name}`}
        >
          <FaHeart />
        </button>
      </div>

      <div className="loomzi-product-info">
        <h3>
          <Link
            to={`/products/${product.id}`}
            className="loomzi-product-name-link"
          >
            {product.name}
          </Link>
        </h3>

        <div className="loomzi-product-rating">
          <span className="loomzi-stars">
            <FaStar /> <FaStar /> <FaStar />
            <FaStar /> <FaStar />
          </span>

          <span className="loomzi-review-count">
            ({product.reviews} reviews)
          </span>
        </div>

        <div className="loomzi-product-bottom">
          <div className="loomzi-price">
            <strong>₹{product.price.toFixed(2)}</strong>

            {product.originalPrice && (
              <del>₹{product.originalPrice.toFixed(2)}</del>
            )}
          </div>

          <button
            type="button"
            className="loomzi-add-cart"
            onClick={handleAddToCart}
            aria-label={`Add ${product.name} to cart`}
          >
            <FaPlus />
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
