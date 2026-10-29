
const mongoose = require("mongoose");

const Offer = require("../models/Offer");
const Coupon = require("../models/Coupon");
const Product = require("../models/Product");
const Category = require("../models/Category");

// ===================================
// Get Active Announcement Promotions
// ===================================
const getAnnouncementPromotions = async (req, res) => {
  try {
    const now = new Date();

    // ===================================
    // 1. Fetch Active Offers
    // ===================================
    const activeOffers = await Offer.find({
      isActive: true,
      startsAt: { $lte: now },
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .lean();

    const announcementOffers = [];

    // ===================================
    // 2. Validate Each Offer Target
    // ===================================
    for (const offer of activeOffers) {
      if (!mongoose.isValidObjectId(offer.target)) {
        continue;
      }

      // CATEGORY OFFER
      if (offer.type === "category") {
        const category = await Category.findById(
          offer.target
        )
          .select("name isListed")
          .lean();

        if (!category || !category.isListed) {
          continue;
        }

        announcementOffers.push({
          id: String(offer._id),
          name: offer.name,
          type: "category",
          targetId: String(category._id),
          targetName: category.name,
          discountPercentage: offer.discountPercentage,
          maximumDiscount: offer.maximumDiscount,
          bannerImage: offer.bannerImage || "",
          link: `/products?category=${encodeURIComponent(
            category.name
          )}`,
          startsAt: offer.startsAt,
          expiresAt: offer.expiresAt,
        });
      }

      // PRODUCT OFFER
      if (offer.type === "product") {
        const product = await Product.findById(
          offer.target
        )
          .select("name isListed category")
          .populate("category", "name isListed")
          .lean();

        if (
          !product ||
          !product.isListed ||
          !product.category ||
          !product.category.isListed
        ) {
          continue;
        }

        announcementOffers.push({
          id: String(offer._id),
          name: offer.name,
          type: "product",
          targetId: String(product._id),
          targetName: product.name,
          discountPercentage: offer.discountPercentage,
          maximumDiscount: offer.maximumDiscount,
          bannerImage: offer.bannerImage || "",
          link: `/products/${product._id}`,
          startsAt: offer.startsAt,
          expiresAt: offer.expiresAt,
        });
      }
    }

    // ===================================
    // 3. Fetch Active Coupon
    // ===================================
    const coupon = await Coupon.findOne({
      isActive: true,
      expiresAt: { $gt: now },

      // Later, add showOnHomepage: true
      // when public coupon management is implemented.
    })
      .sort({ createdAt: -1 })
      .select(
        "code discountType discountValue minimumPurchase maximumDiscount expiresAt"
      )
      .lean();

    // ===================================
    // 4. Build Coupon Response
    // ===================================
    const announcementCoupon = coupon
      ? {
          id: String(coupon._id),
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minimumPurchase: coupon.minimumPurchase,
          maximumDiscount: coupon.maximumDiscount,
          expiresAt: coupon.expiresAt,
        }
      : null;

    // ===================================
    // 5. Send Response
    // ===================================
    return res.status(200).json({
      message:
        "Announcement promotions fetched successfully",

      offers: announcementOffers,
      coupon: announcementCoupon,
    });
  } catch (error) {
    console.error(
      "Announcement promotions error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load announcement promotions",
    });
  }
};

module.exports = {
  getAnnouncementPromotions,
};
