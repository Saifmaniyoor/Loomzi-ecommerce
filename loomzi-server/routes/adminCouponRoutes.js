const router = require('express').Router();
const requireAdmin = require('../middleware/requireAdmin');
const controller = require('../controllers/adminCouponController');
router.use(requireAdmin);
router.get('/',controller.list);
router.post('/',controller.create);
router.patch('/:id',controller.update);
module.exports=router;
