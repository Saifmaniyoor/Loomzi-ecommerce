const router = require('express').Router();
const { loadActiveOffers, calculateOfferPrice } = require('../services/offerPricingServices');
const Product = require('../models/Product');
// Public, read-only. Prices are advisory; checkout recalculates server-side.
router.get('/prices', async (req, res) => {
  try {
    const ids = String(req.query.ids || '').split(',').filter(Boolean).slice(0, 60);
    const mongoose = require('mongoose');
    if (!ids.length || ids.some((id) => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'Valid product IDs required' });
    const [products, offers] = await Promise.all([
      Product.find({ _id: { $in: ids }, isListed: true }).populate('category', 'isListed').lean(), loadActiveOffers(),
    ]);
    return res.json({ prices: products.filter(p => p.category?.isListed).map(p => ({
      productId: String(p._id), ...calculateOfferPrice({ productId: p._id, categoryId: p.category._id, price: p.price, offers }),
    })) });
  } catch(e) { console.error('Offer prices:',e); return res.status(500).json({ message:'Could not load offer prices' }); }
});
module.exports = router;
