const router = require("express").Router();

const requireAdmin = require("../middleware/requireAdmin");
const controller = require("../controllers/adminCouponController");

router.use(requireAdmin);

// Get all coupons
router.get("/", controller.list);

// Create coupon
router.post("/", controller.create);

// Update coupon
router.patch("/:id", controller.update);

// Delete coupon
router.delete("/:id", controller.remove);

module.exports = router;