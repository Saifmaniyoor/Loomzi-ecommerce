import "./ProductRating.css";
export default function ProductRating({ averageRating = 0, count = 0 }) {
  const total = Number(count) || 0;
  const rating = Number(averageRating) || 0;
  return (
    <div className="loomzi-rating" aria-label={total ? `${rating.toFixed(1)} out of 5 from ${total} reviews` : "No reviews yet"}>
      <span className="loomzi-rating-stars" aria-hidden="true">{[1,2,3,4,5].map(n => <span key={n} className={n <= Math.round(rating) && total ? "filled" : ""}>★</span>)}</span>
      <span className="loomzi-rating-text">{total ? `${rating.toFixed(1)} (${total})` : "No reviews yet"}</span>
    </div>
  );
}
