
const Address = require("../models/Address");

const findAddressesByUser = async (userId) => {
  return Address.find({ user: userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });
};

const findAddressById = async (userId, addressId) => {
  return Address.findOne({
    _id: addressId,
    user: userId,
  });
};

const countUserAddresses = async (userId) => {
  return Address.countDocuments({ user: userId });
};

const createAddress = async (data) => {
  return Address.create(data);
};

const updateAddress = async (userId, addressId, data) => {
  return Address.findOneAndUpdate(
    {
      _id: addressId,
      user: userId,
    },
    { $set: data },
    {
      new: true,
      runValidators: true,
    }
  );
};

const deleteAddress = async (userId, addressId) => {
  return Address.findOneAndDelete({
    _id: addressId,
    user: userId,
  });
};

const clearDefaultAddress = async (userId) => {
  return Address.updateMany(
    { user: userId, isDefault: true },
    { $set: { isDefault: false } }
  );
};

const findNewestAddress = async (userId) => {
  return Address.findOne({ user: userId }).sort({
    createdAt: -1,
  });
};

const findDefaultAddress = async (userId) => {
  return Address.findOne({
    user: userId,
    isDefault: true,
  });
};


const findUserAddressById = async (addressId, userId) => {
  return await Address.findOne({
    _id: addressId,
    user: userId,
  });
};


module.exports = {
  findAddressesByUser,
  findAddressById,
  countUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  clearDefaultAddress,
  findNewestAddress,
  findDefaultAddress,
  findUserAddressById,
};
