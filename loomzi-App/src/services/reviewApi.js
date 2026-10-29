const BASE = "http://localhost:5000/api/reviews";
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Review request failed");
  return data;
}
export const getProductReviews = (id) => request(`/product/${encodeURIComponent(id)}`);
export const getReviewEligibility = (id) => request(`/eligibility/${encodeURIComponent(id)}`);
export const createReview = (payload) => request("/", { method: "POST", body: JSON.stringify(payload) });
export const updateReview = (id, payload) => request(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
export const deleteReview = (id) => request(`/${encodeURIComponent(id)}`, { method: "DELETE" });

export const getRatingSummaries = (ids) => request(`/summaries?ids=${ids.map(encodeURIComponent).join(",")}`);
