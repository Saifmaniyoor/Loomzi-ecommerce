const cloudinary = require("../config/cloudinary");
const { Readable } = require("node:stream");

// Verify file content using its binary signature.
const isSupportedImage = (buffer) => {
  if (!Buffer.isBuffer(buffer)) return false;

  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );

  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  return isJpeg || isPng || isWebp;
};

const uploadImage = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "loomzi/products",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result.secure_url);
      }
    );

    Readable.from(file.buffer).pipe(stream);
  });
};

const uploadProductImages = async (files) => {
  if (!files?.length) {
    throw new Error("Please select at least one image.");
  }

  for (const file of files) {
    if (!isSupportedImage(file.buffer)) {
      throw new Error(
        "Invalid image file. Only JPG, PNG and WebP are allowed."
      );
    }
  }

  const uploadedImages = [];

  for (const file of files) {
    const imageUrl = await uploadImage(file);
    uploadedImages.push(imageUrl);
  }

  return uploadedImages;
};

module.exports = {
  uploadProductImages,
};