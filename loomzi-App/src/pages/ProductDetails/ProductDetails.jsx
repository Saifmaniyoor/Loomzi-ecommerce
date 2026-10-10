
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FaHeart,
  FaMinus,
  FaPlus,
  FaStar,
  FaLeaf,
  FaCheck,
} from "react-icons/fa";

import products from "../../data/products";
import ProductCard from "../../components/ProductCard/ProductCard";
import "./ProductDetails.css";

const tabs = ["Description", "Size Guide", "Reviews"];

function ProductDetails() {
  const { id } = useParams();

  const product = products.find(
    (item) => String(item.id) === id
  );

  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("Red");
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState("Description");

  useEffect(() => {
    setActiveImage(0);
    setSelectedSize(product?.sizes?.[0] || "");
    setSelectedColor(product?.colors?.[0] || "Red");
    setQuantity(1);
    setFavorite(false);
    setActiveTab("Description");
  }, [id, product]);

  if (!product) {
    return (
      <main className="pd-not-found">
        <h1>Product not found</h1>
        <Link to="/products">Back to Collection</Link>
      </main>
    );
  }

  const images =
    product.images?.length > 0
      ? product.images
      : [product.image];

  const colors = product.colors || ["Red", "Green", "Blue"];

  const relatedProducts = products
    .filter(
      (item) =>
        item.id !== product.id &&
        item.category === product.category
    )
    .slice(0, 4);

  const handleAddToCart = () => {
    // Connect to Cart API in the next module.
    alert(
      `${product.name}\nSize: ${selectedSize || "Standard"}\nColor: ${selectedColor}\nQuantity: ${quantity}`
    );
  };

  return (
    <main className="pd-page">
      <div className="pd-container">
        <nav className="pd-breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <Link
            to={`/products?category=${encodeURIComponent(
              product.category
            )}`}
          >
            {product.category}
          </Link>
          <span>›</span>
          <span>{product.name}</span>
        </nav>

        <div className="pd-main">
          {/* Product images */}
          <div className="pd-gallery">
            <div className="pd-main-image">
              <img
                src={images[activeImage]}
                alt={product.name}
              />
            </div>

            <div className="pd-thumbnails">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  className={`pd-thumbnail ${
                    activeImage === index ? "active" : ""
                  }`}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product information */}
          <div className="pd-information">
            <h1>{product.name}</h1>

            <div className="pd-price-rating">
              <strong>₹{product.price.toFixed(2)}</strong>

              <div className="pd-rating">
                <span className="pd-stars">
                  {Array.from({ length: 5 }, (_, i) => (
                    <FaStar key={i} />
                  ))}
                </span>
                <span>
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>
            </div>

            <p className="pd-intro">
              {product.description ||
                "A beautiful handmade creation, carefully designed with comfort and quality in mind. Every piece is crafted with love for your little one."}
            </p>

            {product.sizes?.length > 0 && (
              <div className="pd-option-group">
                <h3>Select Size</h3>

                <div className="pd-options">
                  {product.sizes.map((size) => (
                    <button
                      type="button"
                      key={size}
                      className={
                        selectedSize === size ? "selected" : ""
                      }
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pd-option-group">
              <h3>Select Color</h3>

              <div className="pd-options">
                {colors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={
                      selectedColor === color ? "selected" : ""
                    }
                    onClick={() => setSelectedColor(color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="pd-purchase-row">
              <div className="pd-quantity">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) => Math.max(1, q - 1))
                  }
                  aria-label="Decrease quantity"
                >
                  <FaMinus />
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Increase quantity"
                >
                  <FaPlus />
                </button>
              </div>

              <button
                type="button"
                className="pd-add-to-cart"
                onClick={handleAddToCart}
              >
                Add to Cart
              </button>

              <button
                type="button"
                className={`pd-favorite ${favorite ? "active" : ""}`}
                onClick={() => setFavorite(!favorite)}
                aria-label="Toggle wishlist"
                aria-pressed={favorite}
              >
                <FaHeart />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <section className="pd-details-section">
          <div className="pd-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "Reviews"
                  ? `Reviews (${product.reviews})`
                  : tab}
              </button>
            ))}
          </div>

          {activeTab === "Description" && (
            <div className="pd-description-content">
              <div>
                <p>
                  {product.longDescription ||
                    "Designed for joyful days and memorable moments. Each Loomzi piece combines thoughtful craftsmanship with comfortable fabrics and beautiful handmade details."}
                </p>

                <ul className="pd-highlights">
                  <li><FaCheck /> Carefully selected materials</li>
                  <li><FaCheck /> Beautiful handmade details</li>
                  <li><FaCheck /> Designed for everyday comfort</li>
                </ul>
              </div>

              <div className="pd-sustainability">
                <div className="pd-leaf-icon">
                  <FaLeaf />
                </div>

                <div>
                  <h3>Made with Care</h3>
                  <p>
                    Discover thoughtfully crafted products
                    made with attention to detail.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Size Guide" && (
            <div className="pd-tab-panel">
              <h3>Size Guide</h3>
              <p>
                Sizes are sample options. Exact measurements
                will be added when product data is available.
              </p>
            </div>
          )}

          {activeTab === "Reviews" && (
            <div className="pd-tab-panel">
              <h3>Customer Reviews</h3>
              <p>
                Customer reviews will appear here once
                the reviews module is connected.
              </p>
            </div>
          )}
        </section>

        {/* Related products */}
        <section className="pd-related">
          <div className="pd-related-heading">
            <h2>You May Also Love</h2>

            <Link to="/products">
              View All Collection →
            </Link>
          </div>

          <div className="pd-related-grid">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default ProductDetails;
