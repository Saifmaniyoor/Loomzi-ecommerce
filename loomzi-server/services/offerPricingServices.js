const Offer = require('../models/Offer');
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;

const loadActiveOffers = async () => {
  const now = new Date();
  return Offer.find({ isActive: true, startsAt: { $lte: now }, expiresAt: { $gt: now } }).lean();
};

// Every candidate is derived independently from the REGULAR price.
// A manual offer price is a candidate price, never a base for another discount.
const calculateOfferPrice = ({ productId, categoryId, price, manualOfferPrice, offers = [] }) => {
  const regularPrice = Number(price);
  if (!Number.isFinite(regularPrice) || regularPrice < 0) throw new Error('Invalid regular price');
  const candidates = [{ source: 'regular', price: round(regularPrice), offer: null }];
  if (manualOfferPrice !== null && manualOfferPrice !== undefined && manualOfferPrice !== '') {
    const manual = Number(manualOfferPrice);
    if (!Number.isFinite(manual) || manual < 0 || manual > regularPrice) {
      throw new Error('Manual offer price must be between 0 and regular price');
    }
    candidates.push({ source: 'manual', price: round(manual), offer: null });
  }
  for (const offer of offers) {
    const matches = (offer.type === 'product' && String(offer.target) === String(productId)) ||
      (offer.type === 'category' && String(offer.target) === String(categoryId));
    if (!matches) continue;
    const pct = Number(offer.discountPercentage);
    const cap = offer.maximumDiscount == null ? Infinity : Number(offer.maximumDiscount);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || !(cap > 0)) continue;
    const discount = round(Math.min(round(regularPrice * pct / 100), cap, regularPrice));
    candidates.push({ source: offer.type, price: round(regularPrice - discount), offer });
  }
  const rank = { product: 0, category: 1, manual: 2, regular: 3 };
  candidates.sort((a,b) => a.price - b.price || rank[a.source] - rank[b.source] || String(a.offer?._id || '').localeCompare(String(b.offer?._id || '')));
  const best = candidates[0];
  return {
    originalPrice: round(regularPrice),
    regularPrice: round(regularPrice),
    price: best.price,
    finalPrice: best.price,
    offerPrice: best.price < regularPrice ? best.price : null,
    offerDiscount: round(regularPrice - best.price),
    appliedOffer: best.offer ? { id: String(best.offer._id), name: best.offer.name, type: best.offer.type, discountPercentage: best.offer.discountPercentage } : null,
    priceSource: best.source,
  };
};
module.exports = { loadActiveOffers, calculateOfferPrice };
