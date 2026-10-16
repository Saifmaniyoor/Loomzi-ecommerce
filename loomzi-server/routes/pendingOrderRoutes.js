
const express = require("express");

const {
  createPendingOrder,
} = require("../controllers/pendingOrderController");

const requireUser = require("../middleware/requireUser");

const router = express.Router();

router.post(
  "/pending-order",
  requireUser,
  createPendingOrder
);

module.exports = router;
