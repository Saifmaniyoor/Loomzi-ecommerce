
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./ProductSelection.css";

const API_URL = "http://localhost:5000";

function ProductSelection() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/products?page=1&limit=4`,
          { signal: controller.signal }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load products");
        }

        setFavorites(data.products || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => controller.abort();
  }, []);

  return (
    <section className="editors-favorites">
      <div className="favorites-header">
        <div>
          <p className="favorites-subtitle">CURATED FOR YOU</p>
          <h2>Editor's Favorites</h2>
        </div>

        <Link to="/products" className="view-all">
          View All
        </Link>
      </div>

      {loading && <p>Loading products...</p>}

      {error && <p>{error}</p>}

      {!loading && !error && favorites.length === 0 && (
        <p>No products available yet.</p>
      )}

      {!loading && !error && (
        <div className="favorites-grid">
          {favorites.map((product) => (
            <div className="favorite-card" key={product._id}>
              <div className="favorite-image">
                <Link to={`/products/${product._id}`}>
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-image-placeholder">
                      No Image
                    </div>
                  )}
                </Link>
              </div>

              <div className="favorite-info">
                <Link
                  to={`/products/${product._id}`}
                  className="favorite-product-link"
                >
                  <h3>{product.name}</h3>
                </Link>

                <p className="product-category">
                  {product.category?.name}
                </p>

                <p className="product-price">
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ProductSelection;
