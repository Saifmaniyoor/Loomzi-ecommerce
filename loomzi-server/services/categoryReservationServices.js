
const mongoose = require("mongoose");
const Category = require("../models/Category");

// Confirm that a category is listed and coordinate
// with concurrent admin category updates.
const validateCategoryForCheckout = async ({
  categoryId,
  session,
}) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new Error("Invalid category ID");
  }

  if (!session) {
    throw new Error("Category validation requires a transaction");
  }

  const category = await Category.findOneAndUpdate(
    {
      _id: categoryId,
      isListed: true,
    },
    {
      $currentDate: {
        updatedAt: true,
      },
    },
    {
      new: true,
      session,
    }
  );

  if (!category) {
    throw new Error(
      "Product category is unavailable. Please refresh your cart."
    );
  }

  return category;
};

module.exports = {
  validateCategoryForCheckout,
};
