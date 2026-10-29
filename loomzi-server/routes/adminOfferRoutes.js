const router = require('express').Router();
const requireAdmin = require('../middleware/requireAdmin');
const { listOffers, createOffer, updateOffer, toggleOffer, deleteOffer } = require('../controllers/offerController');
router.use(requireAdmin); // Existing super_admin session middleware
const upload = require('../middleware/uploadMiddleware');
const { uploadProductImages } = require('../services/imageServices');
router.post('/upload-banner', (req, res, next) => {
  upload.single('image')(req, res, (error) => error ? res.status(400).json({ message: error.message }) : next());
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select a banner image' });
    const [imageUrl] = await uploadProductImages([req.file], 'loomzi/offer-banners');
    return res.status(201).json({ imageUrl });
  } catch (error) {
    console.error('Offer banner upload:', error);
    return res.status(500).json({ message: 'Could not upload banner' });
  }
});
router.get('/', listOffers);
router.post('/', createOffer);
router.put('/:id', updateOffer);
router.patch('/:id/status', toggleOffer);
router.delete('/:id', deleteOffer);
module.exports = router;
