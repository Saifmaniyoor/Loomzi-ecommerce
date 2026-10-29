
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";

import {
  FaHeart,
  FaMinus,
  FaPlus,
  FaLeaf,
  FaCheck,
} from "react-icons/fa";

import ProductCard from "../../components/ProductCard/ProductCard";
import ProductReviews from "../../components/ProductReviews/ProductReviews";
import ProductRating from "../../components/ProductRating/ProductRating";
import { getRatingSummaries } from "../../services/reviewApi";
import { addToCart } from "../../services/cartApi";

import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../../services/wishlistApi";

import "./ProductDetails.css";
import "../../components/ProductPrice/OfferTag.css";

const API_URL = "http://localhost:5000";

const tabs = ["Description", "Size Guide", "Reviews"];

function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openReviews = searchParams.get("tab") === "reviews";

  // ===============================
  // Product States
  // ===============================
  const [product, setProduct] = useState(null);
  const [ratingSummary, setRatingSummary] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [activeTab, setActiveTab] = useState("Description");

  // ===============================
  // Wishlist States
  // ===============================
  const [favorite, setFavorite] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState("");

  // ===============================
  // Cart States
  // ===============================
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState("");

  // ===============================
  // 1. Fetch Product Details
  // ===============================
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProductDetails() {
      try {
        setLoading(true);
        setError("");
        setProduct(null);
        setRelatedProducts([]);

        const response = await fetch(
          `${API_URL}/api/products/${id}`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load product details"
          );
        }

        const fetchedProduct = data.product;

        setProduct(fetchedProduct);

        // Reset selections for new product
        setActiveImage(0);
        setSelectedSize("");
        setSelectedColor("");
        setQuantity(1);
        setFavorite(false);
        setActiveTab(openReviews ? "Reviews" : "Description");
        setCartError("");
        setWishlistError("");

        // Fetch related products
        const relatedResponse = await fetch(
          `${API_URL}/api/products?page=1&limit=20`,
          { signal: controller.signal }
        );

        if (relatedResponse.ok) {
          const relatedData = await relatedResponse.json();

          const related = (relatedData.products || [])
            .filter(
              (item) =>
                item._id !== fetchedProduct._id &&
                item.category?._id ===
                  fetchedProduct.category?._id
            )
            .slice(0, 4);

          setRelatedProducts(related);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Something went wrong");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProductDetails();

    return () => controller.abort();
  }, [id, openReviews]);

  useEffect(() => {
    let active = true;
    setRatingSummary(null);
    if (id) getRatingSummaries([id]).then(data => { if (active) setRatingSummary(data.ratings?.[id]); }).catch(console.error);
    return () => { active = false; };
  }, [id]);

  // ===============================
  // 2. Check Wishlist Status
  // ===============================
  useEffect(() => {
    if (!id) return;

    let active = true;

    // Reset status while switching products
    setFavorite(false);
    setWishlistError("");

    const checkWishlist = async () => {
      try {
        const data = await getWishlist();

        if (!active) return;

        const exists = (data.products || []).some(
          (item) => item._id === id
        );

        setFavorite(exists);
      } catch (err) {
        if (!active) return;

        if (err.status === 401) {
          setFavorite(false);
        } else {
          console.error("Wishlist check error:", err);
        }
      }
    };

    checkWishlist();

    // Synchronize wishlist with ProductCard
    window.addEventListener(
      "loomzi:wishlist-updated",
      checkWishlist
    );

    return () => {
      active = false;

      window.removeEventListener(
        "loomzi:wishlist-updated",
        checkWishlist
      );
    };
  }, [id]);

  // ===============================
  // 3. Add / Remove Wishlist
  // ===============================
  const handleWishlist = async () => {
    if (!product || wishlistLoading) return;

    try {
      setWishlistLoading(true);
      setWishlistError("");

      if (favorite) {
        await removeFromWishlist(product._id);
        setFavorite(false);
      } else {
        await addToWishlist(product._id);
        setFavorite(true);
      }

      // Notify other wishlist components
      window.dispatchEvent(
        new Event("loomzi:wishlist-updated")
      );
    } catch (err) {
      if (err.status === 401) {
        navigate("/login");
        return;
      }

      setWishlistError(
        err.message || "Failed to update wishlist"
      );
    } finally {
      setWishlistLoading(false);
    }
  };

  // ===============================
  // 4. Product Variants
  // ===============================
  const variants = product?.variants || [];
  const hasVariants = variants.length > 0;

  // Available colors
  const colors = useMemo(() => {
    return [
      ...new Set(
        variants
          .map((variant) => variant.color)
          .filter(Boolean)
      ),
    ];
  }, [variants]);

  // Available sizes
  const sizes = useMemo(() => {
    const matchingVariants = selectedColor
      ? variants.filter(
          (variant) => variant.color === selectedColor
        )
      : variants;

    return [
      ...new Set(
        matchingVariants
          .map((variant) => variant.size)
          .filter(Boolean)
      ),
    ];
  }, [variants, selectedColor]);

  // Find selected variant
  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;

    return (
      variants.find((variant) => {
        const colorMatches =
          !variant.color ||
          variant.color === selectedColor;

        const sizeMatches =
          !variant.size ||
          variant.size === selectedSize;

        return colorMatches && sizeMatches;
      }) || null
    );
  }, [
    variants,
    hasVariants,
    selectedColor,
    selectedSize,
  ]);

  // ===============================
  // 5. Price and Stock
  // ===============================
  // Prefer backend-calculated prices when available. For raw product
  // documents, price is regular and offerPrice is the manual offer.
  const getPricing = (item) => {
    const regular = Number(
      item?.regularPrice ?? item?.originalPrice ?? item?.price ?? 0
    );
    const backendFinal = item?.finalPrice;
    const manualOffer = item?.offerPrice;
    const final = backendFinal != null
      ? Number(backendFinal)
      : manualOffer != null && Number(manualOffer) < regular
        ? Number(manualOffer)
        : Number(item?.price ?? 0);

    return {
      regular: Number.isFinite(regular) ? regular : 0,
      final: Number.isFinite(final) ? final : regular,
    };
  };

  const productPricing = getPricing(product);
  const selectedPricing = selectedVariant
    ? (() => {
        const variantRegular = Number(
          selectedVariant.regularPrice ??
          selectedVariant.originalPrice ??
          selectedVariant.price ??
          product?.regularPrice ??
          product?.originalPrice ??
          product?.price ?? 0
        );
        const variantFinal = selectedVariant.finalPrice != null
          ? Number(selectedVariant.finalPrice)
          : selectedVariant.offerPrice != null &&
              Number(selectedVariant.offerPrice) < variantRegular
            ? Number(selectedVariant.offerPrice)
            : selectedVariant.price != null
              ? variantRegular
              : productPricing.final;
        return { regular: variantRegular, final: variantFinal };
      })()
    : productPricing;

  // Show product pricing until a customer finishes selecting a variant.
  const shownPricing = selectedColor &&
    (selectedSize || !variants.some((v) => v.size)) && selectedVariant
      ? selectedPricing
      : productPricing;

  const formatPrice = (value) =>
    Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const availableStock = hasVariants
    ? Number(selectedVariant?.stock || 0)
    : Number(product?.stock || 0);

  const optionsSelected =
    !hasVariants || Boolean(selectedVariant);

  const isOutOfStock =
    optionsSelected && availableStock <= 0;

  const canAddToCart =
    optionsSelected &&
    availableStock > 0 &&
    quantity <= availableStock;

  // ===============================
  // 6. Product Images
  // ===============================
  const images = product?.images || [];

  const handleColorChange = (color) => {
    setSelectedColor(color);
    setSelectedSize("");
    setQuantity(1);
    setCartError("");
  };

  const handleSizeChange = (size) => {
    setSelectedSize(size);
    setQuantity(1);
    setCartError("");
  };

  // ===============================
  // 7. Add to Cart - Real API
  // ===============================
  const handleAddToCart = async () => {
    if (!canAddToCart || addingToCart || !product) {
      return;
    }

    try {
      setAddingToCart(true);
      setCartError("");

      const variantId = hasVariants
        ? selectedVariant?._id
        : null;

      await addToCart(
        product._id,
        variantId,
        quantity
      );

      // Notify Navbar to refresh cart count
      window.dispatchEvent(
        new Event("loomzi:cart-updated")
      );

      // Redirect to Cart page
      navigate("/cart");
    } catch (err) {
      if (
        err.status === 401 ||
        err.message === "Please login first" ||
        err.message ===
          "User not found. Please login again"
      ) {
        navigate("/login");
        return;
      }

      setCartError(
        err.message || "Failed to add product to cart"
      );
    } finally {
      setAddingToCart(false);
    }
  };

  // ===============================
  // 8. Loading / Error
  // ===============================
  if (loading) {
    return (
      <main className="pd-not-found">
        <h2>Loading product details...</h2>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="pd-not-found">
        <h1>Product unavailable</h1>
        <p>{error || "Product not found"}</p>
        <Link to="/products">
          Back to Collection
        </Link>
      </main>
    );
  }

  // ===============================
  // 9. Product Details UI
  // ===============================
  return (
    <main className="pd-page">
      <div className="pd-container">

        {/* Breadcrumb */}
        <nav className="pd-breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>

          <Link
            to={`/products?category=${encodeURIComponent(
              product.category?.name || "All"
            )}`}
          >
            {product.category?.name || "Collection"}
          </Link>

          <span>›</span>
          <span>{product.name}</span>
        </nav>

        <div className="pd-main">

          {/* Product Gallery */}
          <div className="pd-gallery">
            <div className="pd-main-image">
              {images.length > 0 ? (
                <img
                  src={images[activeImage]}
                  alt={product.name}
                />
              ) : (
                <div className="pd-no-image">
                  No Image Available
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="pd-thumbnails">
                {images.map((image, index) => (
                  <button
                    type="button"
                    key={`${image}-${index}`}
                    className={`pd-thumbnail ${
                      activeImage === index
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveImage(index)
                    }
                    aria-label={`View product image ${
                      index + 1
                    }`}
                  >
                    <img
                      src={image}
                      alt={`${product.name} view ${
                        index + 1
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Information */}
          <div className="pd-information">
            <h1>{product.name}</h1>
            <ProductRating averageRating={ratingSummary?.averageRating} count={ratingSummary?.count} />

            {/* Display the active backend-applied offer */}
            {product.appliedOffer?.name && (
              <div className="loomzi-offer-tags">
                <span className="loomzi-offer-name">
                  {product.appliedOffer.name}
                </span>
                {Number.isFinite(Number(product.appliedOffer.discountPercentage)) &&
                  Number(product.appliedOffer.discountPercentage) > 0 && (
                    <span className="loomzi-offer-percent">
                      {product.appliedOffer.discountPercentage}% OFF
                    </span>
                  )}
              </div>
            )}

            <div className="pd-price-rating">
              <div className="loomzi-product-price">
                <span className="loomzi-final-price">
                  ₹{formatPrice(shownPricing.final)}
                </span>

                {shownPricing.final < shownPricing.regular && (
                  <span className="loomzi-regular-price">
                    ₹{formatPrice(shownPricing.regular)}
                  </span>
                )}
              </div>
            </div>

            <p className="pd-intro">
              {product.description ||
                "A beautiful handmade creation by Loomzi."}
            </p>

            {/* Color Selection */}
            {colors.length > 0 && (
              <div className="pd-option-group">
                <h3>Select Color</h3>

                <div className="pd-options">
                  {colors.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={
                        selectedColor === color
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        handleColorChange(color)
                      }
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {sizes.length > 0 && (
              <div className="pd-option-group">
                <h3>Select Size</h3>

                <div className="pd-options">
                  {sizes.map((size) => (
                    <button
                      type="button"
                      key={size}
                      className={
                        selectedSize === size
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        handleSizeChange(size)
                      }
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Status */}
            <p className="pd-stock-status">
              {!optionsSelected
                ? "Please select the available options"
                : isOutOfStock
                  ? "Out of Stock"
                  : `${availableStock} items available`}
            </p>

            {/* Quantity and Add to Cart */}
            <div className="pd-purchase-row">
              <div className="pd-quantity">
                <button
                  type="button"
                  disabled={
                    addingToCart || quantity <= 1
                  }
                  onClick={() =>
                    setQuantity((q) =>
                      Math.max(1, q - 1)
                    )
                  }
                  aria-label="Decrease quantity"
                >
                  <FaMinus />
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  disabled={
                    addingToCart ||
                    !canAddToCart ||
                    quantity >= availableStock
                  }
                  onClick={() =>
                    setQuantity((q) =>
                      Math.min(
                        availableStock,
                        q + 1
                      )
                    )
                  }
                  aria-label="Increase quantity"
                >
                  <FaPlus />
                </button>
              </div>

              <button
                type="button"
                className="pd-add-to-cart"
                disabled={
                  !canAddToCart || addingToCart
                }
                onClick={handleAddToCart}
              >
                {addingToCart
                  ? "Adding..."
                  : isOutOfStock
                    ? "Out of Stock"
                    : "Add to Cart"}
              </button>

              {/* Wishlist Heart Button */}
              <button
                type="button"
                className={`pd-favorite ${
                  favorite ? "active" : ""
                }`}
                onClick={handleWishlist}
                disabled={wishlistLoading}
                aria-label={
                  favorite
                    ? "Remove from wishlist"
                    : "Add to wishlist"
                }
                aria-pressed={favorite}
              >
                <FaHeart />
              </button>
            </div>

            {/* Cart Error */}
            {cartError && (
              <p
                className="pd-cart-error"
                role="alert"
              >
                {cartError}
              </p>
            )}

            {/* Wishlist Error */}
            {wishlistError && (
              <p
                className="pd-cart-error"
                role="alert"
              >
                {wishlistError}
              </p>
            )}
          </div>
        </div>

        {/* Product Details Tabs */}
        <section className="pd-details-section">
          <div
            className="pd-tabs"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={
                  activeTab === tab
                }
                className={
                  activeTab === tab
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(tab)
                }
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "Description" && (
            <div className="pd-description-content">
              <div>
                <p>{product.description}</p>

                <ul className="pd-highlights">
                  <li>
                    <FaCheck />
                    Carefully selected materials
                  </li>
                  <li>
                    <FaCheck />
                    Beautiful handmade details
                  </li>
                  <li>
                    <FaCheck />
                    Designed for everyday comfort
                  </li>
                </ul>
              </div>

              <div className="pd-sustainability">
                <div className="pd-leaf-icon">
                  <FaLeaf />
                </div>

                <div>
                  <h3>Made with Care</h3>
                  <p>
                    Discover thoughtfully crafted
                    products made with attention
                    to detail.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Size Guide" && (
            <div className="pd-tab-panel">
              <h3>Size Guide</h3>
              <p>
                Please select your preferred size.
                Detailed measurements will be
                added soon.
              </p>
            </div>
          )}

          {activeTab === "Reviews" && (
            <div className="pd-tab-panel">
              <ProductReviews productId={id} />
            </div>
          )}
        </section>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="pd-related">
            <div className="pd-related-heading">
              <h2>You May Also Love</h2>

              <Link to="/products">
                View All Collection →
              </Link>
            </div>

            <div className="pd-related-grid">
              {relatedProducts.map((item) => (
                <ProductCard
                  key={item._id}
                  product={item}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default ProductDetails;
