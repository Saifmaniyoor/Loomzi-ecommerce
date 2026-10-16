
import { useMemo } from "react";
import "./ProductSidebar.css";

function ProductSidebar({
  products,
  category,
  setCategory,
  selectedSize,
  setSelectedSize,
  maxPrice,
  setMaxPrice,
}) {
  // Get categories from real MongoDB products.
  const categories = useMemo(() => {
    const categoryNames = products
      .map((product) => product.category?.name)
      .filter(Boolean);

    return [...new Set(categoryNames)].sort();
  }, [products]);

  // Get available sizes from product variants.
  const sizes = useMemo(() => {
    const allSizes = products.flatMap((product) =>
      (product.variants || [])
        .filter((variant) => Number(variant.stock) > 0)
        .map((variant) => variant.size)
        .filter(Boolean)
    );

    return [...new Set(allSizes)];
  }, [products]);

  // Find the highest product price.
  const highestPrice = useMemo(() => {
    const prices = products.map(
      (product) => Number(product.price) || 0
    );

    return Math.max(1000, ...prices);
  }, [products]);

  // Round up to the nearest 500.
  const priceLimit = Math.ceil(highestPrice / 500) * 500;

  const effectiveMaxPrice = Math.min(maxPrice, priceLimit);

  return (
    <aside className="loomzi-sidebar">
      {/* CATEGORIES */}
      <section className="loomzi-filter-section">
        <h3>📦 Categories</h3>

        {categories.map((item) => {
          const count = products.filter(
            (product) => product.category?.name === item
          ).length;

          return (
            <button
              key={item}
              type="button"
              className={`loomzi-category-option ${
                category === item ? "selected" : ""
              }`}
              onClick={() => setCategory(item)}
            >
              <span>{item}</span>

              <span className="loomzi-category-count">
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          className="loomzi-clear-category"
          onClick={() => setCategory("All")}
        >
          View All Products
        </button>
      </section>

      {/* SIZES */}
      {sizes.length > 0 && (
        <section className="loomzi-filter-section">
          <h3>✿ Size</h3>

          <div className="loomzi-size-options">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                className={`loomzi-size-button ${
                  selectedSize === size ? "selected" : ""
                }`}
                onClick={() =>
                  setSelectedSize(
                    selectedSize === size ? "" : size
                  )
                }
              >
                {size}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* PRICE RANGE */}
      <section className="loomzi-filter-section">
        <h3>🏷 Price Range</h3>

        <input
          type="range"
          min="0"
          max={priceLimit}
          step="50"
          value={effectiveMaxPrice}
          onChange={(event) =>
            setMaxPrice(Number(event.target.value))
          }
          className="loomzi-price-slider"
          aria-label="Maximum product price"
        />

        <div className="loomzi-price-labels">
          <span>₹0</span>
          <span>
            ₹{effectiveMaxPrice.toLocaleString("en-IN")}
          </span>
        </div>
      </section>

      {/* RESET FILTERS */}
      <button
        type="button"
        className="loomzi-reset-filters"
        onClick={() => {
          setCategory("All");
          setSelectedSize("");
          setMaxPrice(priceLimit);
        }}
      >
        Clear Filters
      </button>
    </aside>
  );
}

export default ProductSidebar;
