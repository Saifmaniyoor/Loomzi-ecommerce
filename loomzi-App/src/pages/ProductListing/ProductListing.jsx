
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import products from "../../data/products";
import ProductCard from "../../components/ProductCard/ProductCard";
import ProductSidebar from "../../components/ProductSidebar/ProductSidebar";

import "./ProductListing.css";

const ITEMS_PER_PAGE = 9;
const VALID_CATEGORIES = ["All", "Dresses", "Hairbands", "Crafts"];

function ProductListing() {
  const [searchParams] = useSearchParams();

  const requestedCategory = searchParams.get("category");
  const initialCategory = VALID_CATEGORIES.includes(requestedCategory)
    ? requestedCategory
    : "Dresses";

  const [category, setCategory] = useState(initialCategory);
  const [selectedSize, setSelectedSize] = useState("");
  const [maxPrice, setMaxPrice] = useState(250);
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Update category when a category URL is opened.
  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (category !== "All") {
      result = result.filter(
        (product) => product.category === category
      );
    }

    if (selectedSize) {
      result = result.filter(
        (product) => product.sizes.includes(selectedSize)
      );
    }

    result = result.filter(
      (product) => product.price <= maxPrice
    );

    if (search.trim()) {
      result = result.filter((product) =>
        product.name
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      );
    }

    if (sortBy === "low-to-high") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "high-to-low") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      result.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    return result;
  }, [category, selectedSize, maxPrice, sortBy, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [category, selectedSize, maxPrice, sortBy, search]);

  const totalPages = Math.ceil(
    filteredProducts.length / ITEMS_PER_PAGE
  );

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const currentProducts = filteredProducts.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const pageTitle =
    category === "Dresses"
      ? "Hand-Stitched Dresses"
      : category === "All"
      ? "Our Collection"
      : category === "Hairbands"
      ? "Handmade Hairbands"
      : "Handmade Crafts";

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
                  {filteredProducts.length === 0
                    ? "Showing 0 results"
                    : `Showing ${startIndex + 1}-${Math.min(
                        startIndex + ITEMS_PER_PAGE,
                        filteredProducts.length
                      )} of ${filteredProducts.length} results`}
                </p>
              </div>

              <div className="loomzi-sort-container">
                <label htmlFor="loomzi-sort">Sort by:</label>

                <select
                  id="loomzi-sort"
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value)
                  }
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
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                aria-label="Search products"
              />
            </div>

            {currentProducts.length > 0 ? (
              <div className="loomzi-products-grid">
                {currentProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                  />
                ))}
              </div>
            ) : (
              <div className="loomzi-empty-products">
                <h2>No products found</h2>
                <p>Try changing your filters or search.</p>
              </div>
            )}

            {totalPages > 1 && (
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
                      currentPage === page ? "active" : ""
                    }
                    onClick={() => setCurrentPage(page)}
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
