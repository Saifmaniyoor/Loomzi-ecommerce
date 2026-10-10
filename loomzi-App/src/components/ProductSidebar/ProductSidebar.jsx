
import "./ProductSidebar.css";

const categories = ["Dresses", "Hairbands", "Crafts"];
const sizes = ["Small", "Medium", "Large", "X-Large", "XX-Large"];

function ProductSidebar({
  products,
  category,
  setCategory,
  selectedSize,
  setSelectedSize,
  maxPrice,
  setMaxPrice,
}) {
  return (
    <aside className="loomzi-sidebar">
      <section className="loomzi-filter-section">
        <h3>📦 Categories</h3>

        {categories.map((item) => {
          const count = products.filter(
            (product) => product.category === item
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

      <section className="loomzi-filter-section">
        <h3>🏷 Price Range</h3>

        <input
          type="range"
          min="20"
          max="250"
          step="5"
          value={maxPrice}
          onChange={(event) =>
            setMaxPrice(Number(event.target.value))
          }
          className="loomzi-price-slider"
          aria-label="Maximum product price"
        />

        <div className="loomzi-price-labels">
          <span>₹20</span>
          <span>₹{maxPrice}</span>
        </div>
      </section>

      <button
        type="button"
        className="loomzi-reset-filters"
        onClick={() => {
          setCategory("All");
          setSelectedSize("");
          setMaxPrice(250);
        }}
      >
        Clear Filters
      </button>
    </aside>
  );
}

export default ProductSidebar;
