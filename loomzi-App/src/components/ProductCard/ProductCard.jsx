import { useEffect, useState } from "react";
import { FaHeart, FaPlus } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import ProductPrice from "../ProductPrice/ProductPrice";
import ProductRating from "../ProductRating/ProductRating";

import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../../services/wishlistApi";

import "./ProductCard.css";
import "../ProductPrice/OfferTag.css";

function ProductCard({ product, ratingSummary }) {
  const navigate = useNavigate();

  const [isFavorite, setIsFavorite] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const productId = product._id;
  const productImage = product.images?.[0];

  const hasVariants = product.variants?.length > 0;

  const totalStock = hasVariants
    ? product.variants.reduce(
        (total, variant) => total + Number(variant.stock || 0),
        0,
      )
    : Number(product.stock || 0);

  const isOutOfStock = totalStock <= 0;

  // Active offer details from backend
  const appliedOffer = product.appliedOffer;
  const hasAppliedOffer = Boolean(appliedOffer?.name);

  const discountPercentage = Number(appliedOffer?.discountPercentage);

  // Check whether product is in wishlist
  useEffect(() => {
    let active = true;

    const checkWishlist = async () => {
      try {
        const data = await getWishlist();

        if (active) {
          const exists = (data.products || []).some(
            (item) => item._id === productId,
          );

          setIsFavorite(exists);
        }
      } catch (error) {
        if (active && error.status !== 401) {
          console.error("Wishlist check error:", error);
        }
      }
    };

    checkWishlist();

    const refreshWishlist = () => {
      checkWishlist();
    };

    window.addEventListener("loomzi:wishlist-updated", refreshWishlist);

    return () => {
      active = false;
      window.removeEventListener("loomzi:wishlist-updated", refreshWishlist);
    };
  }, [productId]);

  const handleWishlist = async () => {
    if (wishlistLoading) return;

    setWishlistLoading(true);

    try {
      if (isFavorite) {
        await removeFromWishlist(productId);
        setIsFavorite(false);
      } else {
        await addToWishlist(productId);
        setIsFavorite(true);
      }

      window.dispatchEvent(new Event("loomzi:wishlist-updated"));
    } catch (error) {
      if (error.status === 401) {
        navigate("/login");
      } else {
        alert(error.message);
      }
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleAddToCart = () => {
    navigate(`/products/${productId}`);
  };

  return (
    <article className="loomzi-product-card">
      <div className="loomzi-product-image">
        {product.appliedOffer?.name && (
          <div className="loomzi-image-offer-tag">
            <span className="loomzi-image-offer-name">
              {product.appliedOffer.name}
            </span>

            {Number(product.appliedOffer.discountPercentage) > 0 && (
              <span className="loomzi-image-offer-discount">
                {product.appliedOffer.discountPercentage}% OFF
              </span>
            )}
          </div>
        )}
        <Link to={`/products/${productId}`}>
          {productImage ? (
            <img src={productImage} alt={product.name} loading="lazy" />
          ) : (
            <div className="loomzi-no-image">No Image Available</div>
          )}
        </Link>

        {isOutOfStock && (
          <span className="loomzi-stock-badge">Out of Stock</span>
        )}

        <button
          type="button"
          className={`loomzi-wishlist ${isFavorite ? "active" : ""}`}
          onClick={handleWishlist}
          disabled={wishlistLoading}
          aria-label={
            isFavorite
              ? `Remove ${product.name} from wishlist`
              : `Add ${product.name} to wishlist`
          }
          aria-pressed={isFavorite}
        >
          <FaHeart />
        </button>
      </div>

      <div className="loomzi-product-info">
        <h3>
          <Link
            to={`/products/${productId}`}
            className="loomzi-product-name-link"
          >
            {product.name}
          </Link>
        </h3>

        <div className="loomzi-product-category">
          {product.category?.name || "Loomzi Collection"}
        </div>


        <ProductRating averageRating={ratingSummary?.averageRating} count={ratingSummary?.count} />

        <div className="loomzi-product-bottom">
          {/* Regular Price + Offer Price */}
          <div className="loomzi-price">
            <ProductPrice product={product} />
          </div>

          <button
            type="button"
            className="loomzi-add-cart"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            aria-label={`Select options for ${product.name}`}
          >
            <FaPlus />
          </button>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
