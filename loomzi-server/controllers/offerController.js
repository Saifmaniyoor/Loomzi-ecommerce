
const mongoose = require("mongoose");

const Offer = require("../models/Offer");
const Product = require("../models/Product");
const Category = require("../models/Category");

// ===================================
// Validate Offer Data
// ===================================
const parseOffer = async (body) => {
  const name = String(body.name || "").trim();
  const type = body.type;
  const target = body.target;

  const discountPercentage = Number(
    body.discountPercentage
  );

  const maximumDiscount = Number(
    body.maximumDiscount
  );

  const startsAt = new Date(body.startsAt);
  const expiresAt = new Date(body.expiresAt);

  // Optional banner image URL
  const bannerImage =
    body.bannerImage === undefined
      ? undefined
      : String(body.bannerImage ?? "").trim();

  // Validate required fields
  if (
    !name ||
    name.length > 100 ||
    !["product", "category"].includes(type) ||
    !mongoose.isValidObjectId(target) ||
    !Number.isFinite(discountPercentage) ||
    discountPercentage <= 0 ||
    discountPercentage > 100 ||
    !Number.isFinite(maximumDiscount) ||
    maximumDiscount < 0 ||
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= startsAt
  ) {
    const error = new Error(
      "Invalid offer. Check name, target, percentage, cap, and dates."
    );

    error.status = 400;
    throw error;
  }

  // Validate selected product/category
  const exists =
    type === "product"
      ? await Product.exists({ _id: target })
      : await Category.exists({ _id: target });

  if (!exists) {
    const error = new Error(
      "Selected product or category not found"
    );

    error.status = 404;
    throw error;
  }

  const payload = {
    name,
    type,
    target,
    discountPercentage,
    maximumDiscount,
    startsAt,
    expiresAt,
    isActive:
      body.isActive === true ||
      body.isActive === "true",
  };

  // Include only when supplied.
  // An empty string explicitly removes the image.
  if (bannerImage !== undefined) {
    payload.bannerImage = bannerImage;
  }

  return payload;
};

// ===================================
// Error Handler
// ===================================
const fail = (res, error) => {
  console.error("Offer management error:", error);

  return res.status(error.status || 500).json({
    message: error.status
      ? error.message
      : "Offer request failed",
  });
};

// ===================================
// List Offers
// ===================================
const listOffers = async (_req, res) => {
  try {
    const offers = await Offer.find()
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ offers });
  } catch (error) {
    return fail(res, error);
  }
};

// ===================================
// Create Offer
// ===================================
const createOffer = async (req, res) => {
  try {
    const payload = await parseOffer(
      req.body || {}
    );

    const offer = await Offer.create(payload);

    return res.status(201).json({
      offer,
    });
  } catch (error) {
    return fail(res, error);
  }
};

// ===================================
// Update Offer
// ===================================
const updateOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid offer ID",
      });
    }

    const payload = await parseOffer(
      req.body || {}
    );

    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      {
        $set: payload,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    return res.status(200).json({
      offer,
    });
  } catch (error) {
    return fail(res, error);
  }
};

// ===================================
// Toggle Offer Status
// ===================================
const toggleOffer = async (req, res) => {
  try {
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      typeof req.body?.isActive !== "boolean"
    ) {
      return res.status(400).json({
        message: "Invalid offer ID or status",
      });
    }

    const offer = await Offer.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isActive: req.body.isActive,
        },
      },
      {
        new: true,
      }
    );

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    return res.status(200).json({
      offer,
    });
  } catch (error) {
    return fail(res, error);
  }
};

// ===================================
// Delete Offer
// ===================================
const deleteOffer = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid offer ID",
      });
    }

    const offer = await Offer.findByIdAndDelete(
      req.params.id
    );

    if (!offer) {
      return res.status(404).json({
        message: "Offer not found",
      });
    }

    return res.status(200).json({
      message: "Offer deleted",
    });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = {
  listOffers,
  createOffer,
  updateOffer,
  toggleOffer,
  deleteOffer,
};
