
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import ProductCard from "../../components/ProductCard/ProductCard";
import ProductSidebar from "../../components/ProductSidebar/ProductSidebar";
import { getRatingSummaries } from "../../services/reviewApi";

import "./ProductListing.css";

const API_URL = "http://localhost:5000";
const ITEMS_PER_PAGE = 9;
const FETCH_LIMIT = 100;

// Use the offer-adjusted price when provided by the backend.
const getProductPrice = (product) => {
  const originalPrice = Number(
    product.originalPrice ?? product.price ?? 0
  );

  const offerPrice = Number(product.offerPrice);

  if (
    Number.isFinite(offerPrice) &&
    offerPrice >= 0 &&
    offerPrice < originalPrice
  ) {
    return offerPrice;
  }

  return originalPrice;
};

// Prepare display information for ProductCard.
const prepareProduct = (product) => {
  const originalPrice = Number(
    product.originalPrice ?? product.price ?? 0
  );

  const finalPrice = getProductPrice(product);

  const hasOffer =
    originalPrice > 0 && finalPrice < originalPrice;

  const discountPercentage = hasOffer
    ? Math.round(
        ((originalPrice - finalPrice) / originalPrice) * 100
      )
    : 0;

  return {
    ...product,
    originalPrice,
    offerPrice: finalPrice,
    hasOffer,
    discountPercentage,
  };
};

function ProductListing() {
  const [searchParams] = useSearchParams();

  const requestedCategory =
    searchParams.get("category") || "All";

  const [products, setProducts] = useState([]);
  const [ratingSummaries, setRatingSummaries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState(requestedCategory);
  const [selectedSize, setSelectedSize] = useState("");
  const [maxPrice, setMaxPrice] = useState(Infinity);
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ==========================================
  // Fetch products from MongoDB
  // ==========================================
  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/products?page=1&limit=${FETCH_LIMIT}`,
          {
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load products."
          );
        }

        if (!controller.signal.aborted) {
          const preparedProducts = (
            data.products || []
          ).map(prepareProduct);

          setProducts(preparedProducts);
          const ids = preparedProducts.map(p => p._id).filter(Boolean);
          if (ids.length) {
            getRatingSummaries(ids).then(result => {
              if (!controller.signal.aborted) setRatingSummaries(result.ratings || {});
            }).catch(err => console.error("Ratings unavailable:", err));
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "Something went wrong."
          );
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

  // ==========================================
  // Update category from URL
  // ==========================================
  useEffect(() => {
    setCategory(requestedCategory);
  }, [requestedCategory]);

  // ==========================================
  // Filtering and sorting
  // ==========================================
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filtering
    if (category !== "All") {
      result = result.filter(
        (product) =>
          product.category?.name?.toLowerCase() ===
          category.toLowerCase()
      );
    }

    // Size filtering
    if (selectedSize) {
      result = result.filter((product) =>
        product.variants?.some(
          (variant) =>
            variant.size === selectedSize &&
            Number(variant.stock) > 0
        )
      );
    }

    // Price filtering using final offer price
    result = result.filter(
      (product) =>
        getProductPrice(product) <= Number(maxPrice)
    );

    // Search filtering
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();

      result = result.filter((product) =>
        product.name.toLowerCase().includes(keyword)
      );
    }

    // Sorting using final offer price
    if (sortBy === "low-to-high") {
      result.sort(
        (a, b) =>
          getProductPrice(a) - getProductPrice(b)
      );
    } else if (sortBy === "high-to-low") {
      result.sort(
        (a, b) =>
          getProductPrice(b) - getProductPrice(a)
      );
    } else if (sortBy === "name") {
      result.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      );
    }

    return result;
  }, [
    products,
    category,
    selectedSize,
    maxPrice,
    sortBy,
    search,
  ]);

  // ==========================================
  // Reset pagination when filters change
  // ==========================================
  useEffect(() => {
    setCurrentPage(1);
  }, [
    category,
    selectedSize,
    maxPrice,
    sortBy,
    search,
  ]);

  const totalPages = Math.ceil(
    filteredProducts.length / ITEMS_PER_PAGE
  );

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE;

  const currentProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // ==========================================
  // Page title
  // ==========================================
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

        {/* Breadcrumb */}
        <div className="loomzi-breadcrumb">
          <Link to="/">Home</Link>
          <span>›</span>
          <span>
            {category === "All" ? "Shop" : category}
          </span>
        </div>

        <div className="loomzi-listing-layout">

          {/* Sidebar */}
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

            {/* Header */}
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
                        filteredProducts.length
                      )} of ${filteredProducts.length} results`}
                </p>
              </div>

              {/* Sorting */}
              <div className="loomzi-sort-container">
                <label htmlFor="loomzi-sort">
                  Sort by:
                </label>

                <select
                  id="loomzi-sort"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value)
                  }
                >
                  <option value="newest">
                    Newest Arrivals
                  </option>
                  <option value="low-to-high">
                    Price: Low to High
                  </option>
                  <option value="high-to-low">
                    Price: High to Low
                  </option>
                  <option value="name">
                    Name: A to Z
                  </option>
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="loomzi-product-search">
              <input
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                aria-label="Search products"
              />
            </div>

            {/* Products */}
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
                  <ProductCard
                    key={product._id}
                    product={product}
                    ratingSummary={ratingSummaries[product._id]}
                  />
                ))}
              </div>
            ) : (
              <div className="loomzi-empty-products">
                <h2>No products found</h2>
                <p>
                  Try changing your filters or search.
                </p>
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && totalPages > 1 && (
              <div className="loomzi-pagination">

                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => page - 1)
                  }
                >
                  ‹
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <button
                    type="button"
                    key={page}
                    className={
                      currentPage === page
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setCurrentPage(page)
                    }
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => page + 1)
                  }
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
