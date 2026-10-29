
const express = require("express");
const router = express.Router();

const {
  getAnnouncementPromotions,
} = require("../controllers/promotionController");

router.get("/announcement", getAnnouncementPromotions);

module.exports = router;
