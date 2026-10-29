import { useEffect, useState } from "react";
import { createReview, deleteReview, getProductReviews, getReviewEligibility, updateReview } from "../../services/reviewApi";
import "./ProductReviews.css";

export default function ProductReviews({ productId }) {
  const [data, setData] = useState({ reviews: [], count: 0, averageRating: 0 });
  const [eligibility, setEligibility] = useState(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    getProductReviews(productId).then(value => { if (active) setData(value); }).catch(err => { if (active) setError(err.message); });
    getReviewEligibility(productId).then(value => { if (active) setEligibility(value); }).catch(() => { if (active) setEligibility(null); });
    return () => { active = false; };
  }, [productId, refresh]);

  useEffect(() => {
    if (eligibility?.review) {
      setRating(eligibility.review.rating);
      setTitle(eligibility.review.title || "");
      setComment(eligibility.review.comment || "");
    } else { setRating(5); setTitle(""); setComment(""); }
  }, [eligibility]);

  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const payload = { rating, title, comment };
      if (eligibility?.review) await updateReview(eligibility.review._id, payload);
      else await createReview({ ...payload, productId });
      setMessage("Your review has been saved."); setRefresh(x => x + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!eligibility?.review || !window.confirm("Delete your review?")) return;
    setBusy(true); setError("");
    try { await deleteReview(eligibility.review._id); setMessage("Review deleted."); setRefresh(x => x + 1); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <div className="loomzi-reviews">
    <h3>Customer Reviews</h3>
    <p className="loomzi-review-summary">★ {Number(data.averageRating).toFixed(1)} / 5 · {data.count} reviews</p>
    {error && <p role="alert" className="loomzi-review-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    {eligibility?.eligible && <form className="loomzi-review-form" onSubmit={submit}>
      <h4>{eligibility.review ? "Edit your review" : "Write a Review"}</h4>
      <label>Rating <select value={rating} onChange={e => setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} star{n !== 1 ? "s" : ""}</option>)}</select></label>
      <label>Title <input value={title} maxLength={100} onChange={e => setTitle(e.target.value)} /></label>
      <label>Your review <textarea required value={comment} maxLength={1000} onChange={e => setComment(e.target.value)} rows={4}/></label>
      <button type="submit" disabled={busy || !comment.trim()}>{busy ? "Saving..." : eligibility.review ? "Update Review" : "Submit Review"}</button>
      {eligibility.review && <button type="button" disabled={busy} onClick={remove}>Delete Review</button>}
    </form>}
    {eligibility && !eligibility.eligible && !eligibility.review && <p>Reviews can be submitted after your purchased item is delivered.</p>}
    {!data.reviews.length && <p>No reviews yet.</p>}
    {data.reviews.map(review => <article className="loomzi-review-item" key={review._id}>
      <div className="loomzi-review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
      <strong>{review.title || "Customer review"}</strong>
      <p>{review.comment}</p>
      <small>{review.user?.fullName || "Customer"} · Verified Purchase · {new Date(review.createdAt).toLocaleDateString()}</small>
    </article>)}
  </div>;
}
