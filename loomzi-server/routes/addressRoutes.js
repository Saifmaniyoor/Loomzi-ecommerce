
const express = require("express");
const router = express.Router();

const requireUser = require("../middleware/requireUser");

const {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../controllers/addressController");

router.use(requireUser);

router.get("/", getAddresses);
router.post("/", addAddress);
router.patch("/:id", updateAddress);
router.delete("/:id", deleteAddress);
router.patch("/:id/default", setDefaultAddress);

module.exports = router;
