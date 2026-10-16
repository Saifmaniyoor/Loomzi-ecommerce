import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import ProductCard from "../../components/ProductCard/ProductCard";
import ProductSidebar from "../../components/ProductSidebar/ProductSidebar";

import "./ProductListing.css";

const API_URL = "http://localhost:5000";
const ITEMS_PER_PAGE = 9;

// Temporary maximum while we connect all filters.
// Your backend currently allows up to 100 products per request.
const FETCH_LIMIT = 100;

function ProductListing() {
  const [searchParams] = useSearchParams();

  const requestedCategory = searchParams.get("category") || "All";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState(requestedCategory);
  const [selectedSize, setSelectedSize] = useState("");
  const [maxPrice, setMaxPrice] = useState(Infinity);
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch real products from MongoDB.
  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/products?page=1&limit=${FETCH_LIMIT}`,
          { signal: controller.signal },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load products.");
        }

        if (!controller.signal.aborted) {
          setProducts(data.products || []);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Something went wrong.");
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

  // Update category when opening a category URL.
  useEffect(() => {
    setCategory(requestedCategory);
  }, [requestedCategory]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filtering
    if (category !== "All") {
      result = result.filter(
        (product) =>
          product.category?.name?.toLowerCase() === category.toLowerCase(),
      );
    }

    // Size filtering
    if (selectedSize) {
      result = result.filter((product) =>
        product.variants?.some(
          (variant) =>
            variant.size === selectedSize && Number(variant.stock) > 0,
        ),
      );
    }

    // Price filtering
    result = result.filter(
      (product) => Number(product.price) <= Number(maxPrice),
    );

    // Search filtering
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();

      result = result.filter((product) =>
        product.name.toLowerCase().includes(keyword),
      );
    }

    // Sorting
    if (sortBy === "low-to-high") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high-to-low") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  }, [products, category, selectedSize, maxPrice, sortBy, search]);

  // Reset pagination when filters change.
  useEffect(() => {
    setCurrentPage(1);
  }, [category, selectedSize, maxPrice, sortBy, search]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const currentProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const pageTitle =
    category === "All"
      ? "Our Collection"
      : category === "Dresses"
        ? "Hand-Stitched Dresses"
        : category === "Hairbands"
          ? "Handmade Hairbands"
          : category === "Crafts"
            ? "Handmade Crafts"
            : category;

  return (
    <main className="loomzi-listing-page">
      <div className="loomzi-listing-container">
        <div className="loomzi-breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <span>{category === "All" ? "Shop" : category}</span>
        </div>

        <div className="loomzi-listing-layout">
          <ProductSidebar
            products={products}
            category={category}
            setCategory={setCategory}
            selectedSize={selectedSize}
            setSelectedSize={setSelectedSize}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
          />

          <section className="loomzi-products-section">
            <div className="loomzi-listing-header">
              <div>
                <h1>{pageTitle}</h1>

                <p>
                  {loading
                    ? "Loading products..."
                    : filteredProducts.length === 0
                      ? "Showing 0 results"
                      : `Showing ${startIndex + 1}-${Math.min(
                          startIndex + ITEMS_PER_PAGE,
                          filteredProducts.length,
                        )} of ${filteredProducts.length} results`}
                </p>
              </div>

              <div className="loomzi-sort-container">
                <label htmlFor="loomzi-sort">Sort by:</label>

                <select
                  id="loomzi-sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="low-to-high">Price: Low to High</option>
                  <option value="high-to-low">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </div>
            </div>

            <div className="loomzi-product-search">
              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search products"
              />
            </div>

            {loading ? (
              <p>Loading products...</p>
            ) : error ? (
              <div className="loomzi-empty-products">
                <h2>Unable to load products</h2>
                <p>{error}</p>
              </div>
            ) : currentProducts.length > 0 ? (
              <div className="loomzi-products-grid">
                {currentProducts.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            ) : (
              <div className="loomzi-empty-products">
                <h2>No products found</h2>
                <p>Try changing your filters or search.</p>
              </div>
            )}

            {!loading && !error && totalPages > 1 && (
              <div className="loomzi-pagination">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  ‹
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <button
                    type="button"
                    key={page}
                    className={currentPage === page ? "active" : ""}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  ›
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default ProductListing;
