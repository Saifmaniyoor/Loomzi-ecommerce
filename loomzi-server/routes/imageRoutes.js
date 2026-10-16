const express = require("express");
const upload = require("../middleware/uploadMiddleware");
const requireAdmin = require("../middleware/requireAdmin");

const {
  uploadImages,
} = require("../controllers/imageController");

const router = express.Router();

router.post(
  "/",
  requireAdmin,
  (req, res, next) => {
    upload.array("images", 5)(req, res, (error) => {
      if (error) {
        return res.status(400).json({
          message: error.message,
        });
      }

      next();
    });
  },
  uploadImages
);

module.exports = router;