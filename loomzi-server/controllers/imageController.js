const {
  uploadProductImages,
} = require("../services/imageServices");

const uploadImages = async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        message: "Please select at least one image.",
      });
    }

    const images = await uploadProductImages(files);

    return res.status(201).json({
      message: "Images uploaded successfully",
      images,
    });
  } catch (error) {
  console.error("Cloudinary Upload Error:", error);

  return res.status(500).json({
    message: "Failed to upload images.",
  });
}
};

module.exports = {
  uploadImages,
};