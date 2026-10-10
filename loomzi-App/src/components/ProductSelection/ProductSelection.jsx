import "./ProductSelection.css";

import dress1 from "./images/favorite-dress-1.jpg";
import dress2 from "./images/favorite-dress-2.jpg";
import hairband from "./images/favorite-hairband.jpg";
import dress3 from "./images/favorite-dress-3.jpg";

const favorites = [
  {
    id: 1,
    name: "Floral Party Dress",
    price: "₹1,499",
    rating: 5,
    reviews: 24,
    image: dress1,
  },
  {
    id: 2,
    name: "Pink Cotton Frock",
    price: "₹1,299",
    rating: 4.8,
    reviews: 18,
    image: dress2,
  },
  {
    id: 3,
    name: "Handmade Hairband",
    price: "₹399",
    rating: 5,
    reviews: 32,
    image: hairband,
  },
  {
    id: 4,
    name: "Embroidered Kids Dress",
    price: "₹1,699",
    rating: 4.9,
    reviews: 21,
    image: dress3,
  },
];

function ProductSelection() {
  return (
    <section className="editors-favorites">

      <div className="favorites-header">
        <div>
          <p className="favorites-subtitle">CURATED FOR YOU</p>
          <h2>Editor's Favorites</h2>
        </div>

        <a href="/products" className="view-all">
          View All
        </a>
      </div>

      <div className="favorites-grid">

        {favorites.map((product) => (

          <div className="favorite-card" key={product.id}>

            {/* Product Image */}
            <div className="favorite-image">

              <img
                src={product.image}
                alt={product.name}
              />

              <button
                className="favorite-btn"
                aria-label="Add to favorites"
              >
                ♡
              </button>

            </div>

            {/* Product Details */}
            <div className="favorite-info">

              <h3>{product.name}</h3>

              {/* Rating */}
              <div className="product-rating">
                <span className="stars">★★★★★</span>

                <span className="rating-number">
                  {product.rating}
                </span>

                <span className="review-count">
                  ({product.reviews})
                </span>
              </div>

              {/* Price */}
              <p className="product-price">
                {product.price}
              </p>

            </div>

          </div>

        ))}

      </div>

    </section>
  );
}

export default ProductSelection;