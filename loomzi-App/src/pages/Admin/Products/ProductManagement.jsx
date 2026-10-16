import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./ProductManagement.css";

const API_URL = "http://localhost:5000";

function ProductManagement() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search,
          page: String(page),
          limit: "10",
        });

        const response = await fetch(
          `${API_URL}/api/admin/products?${params}`,
          {
            credentials: "include",
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch products");
        }

        if (!cancelled) {
          setProducts(data.products || []);
          setTotalProducts(data.totalProducts || 0);
          setTotalPages(Math.max(1, data.totalPages || 1));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Something went wrong");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      cancelled = true;
    };
  }, [search, page]);

  // Calculate total product stock
const getTotalStock = (product) => {
  if (product.variants && product.variants.length > 0) {
    return product.variants.reduce((total, variant) => {
      return total + Number(variant.stock || 0);
    }, 0);
  }

  return Number(product.stock || 0);
};

// Handle List / Unlist product
const handleProductStatus = async (product) => {
  const action = product.isListed ? "unlist" : "list";

  const confirmed = window.confirm(
    `Are you sure you want to ${action} "${product.name}"?`
  );

  if (!confirmed) return;

  setUpdatingId(product._id);
  setError("");

  try {
    const response = await fetch(
      `${API_URL}/api/admin/products/${product._id}/${action}`,
      {
        method: "PATCH",
        credentials: "include",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || `Failed to ${action} product`
      );
    }

    setProducts((previousProducts) =>
      previousProducts.map((item) =>
        item._id === product._id
          ? {
              ...item,
              isListed: data.product.isListed,
            }
          : item
      )
    );
  } catch (err) {
    setError(err.message || "Something went wrong");
  } finally {
    setUpdatingId(null);
  }
};

  return (
    <div className="product-management">
      <div className="product-heading">
        <div>
          <h1>Product Management</h1>
          <p>Manage Loomzi products and inventory.</p>
        </div>

        <Link to="/admin/products/add" className="product-add-btn">
          + Add Product
        </Link>
      </div>

      <div className="product-toolbar">
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        <span>Total Products: {totalProducts}</span>
      </div>

      {error && <p className="product-error">{error}</p>}

      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Size Type</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7">Loading products...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan="7">No products found.</td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id}>
                  <td>{product.name}</td>

                  <td>{product.category?.name || "—"}</td>

                  <td>₹{product.price.toLocaleString("en-IN")}</td>

                  <td>
                    {product.sizeType === "age"
                      ? "Age-Based"
                      : product.sizeType === "standard"
                        ? "Standard"
                        : "No Size"}
                  </td>

                  <td>{getTotalStock(product)}</td>

                  <td>
                    <span
                      className={
                        product.isListed
                          ? "product-status listed"
                          : "product-status unlisted"
                      }
                    >
                      {product.isListed ? "Listed" : "Unlisted"}
                    </span>
                  </td>
                  <td>
  <div className="product-actions">
    <Link
      to={`/admin/products/edit/${product._id}`}
      className="product-edit-btn"
    >
      Edit
    </Link>

    <button
      type="button"
      className={
        product.isListed
          ? "product-status-btn unlist-btn"
          : "product-status-btn list-btn"
      }
      onClick={() => handleProductStatus(product)}
      disabled={updatingId === product._id}
    >
      {updatingId === product._id
        ? "Updating..."
        : product.isListed
          ? "Unlist"
          : "List"}
    </button>
  </div>
</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="product-pagination">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((previous) => previous - 1)}
        >
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((previous) => previous + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default ProductManagement;
