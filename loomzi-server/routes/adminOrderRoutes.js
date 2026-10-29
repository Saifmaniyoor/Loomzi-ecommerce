const router = require("express").Router();
const requireAdmin = require("../middleware/requireAdmin");
const { listOrders, getOrder, updateDelivery } = require("../controllers/adminOrderController");
router.use(requireAdmin);
router.get("/", listOrders);
router.get("/:id", getOrder);
router.patch("/:id/delivery", updateDelivery);
module.exports = router;
