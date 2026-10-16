const multer = require("multer");

// Keep uploaded files in memory temporarily.
const storage = multer.memoryStorage();

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const fileFilter = (req, file, callback) => {
  if (!allowedTypes.includes(file.mimetype)) {
    return callback(
      new Error("Only JPG, PNG and WebP images are allowed.")
    );
  }

  callback(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per image
    files: 5,
  },
});

module.exports = upload;