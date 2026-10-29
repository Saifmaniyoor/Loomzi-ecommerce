const Coupon = require('../models/Coupon');
const mongoose = require('mongoose');
const normalize = (v) => String(v || '').trim().toUpperCase();
const isMoney = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && Math.round(v * 100) === v * 100;
const validate = (body) => {
  const code = normalize(body.code);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return 'Coupon code must be 3–30 letters, digits, _ or -';
  if (typeof body.discountValue !== 'number' || !Number.isFinite(body.discountValue) || body.discountValue <= 0 || body.discountValue > 100) return 'Percentage must be between 0 and 100';
  if (!isMoney(body.minimumPurchase) || !isMoney(body.maximumDiscount)) return 'Minimum purchase and maximum discount must be non-negative amounts with at most two decimals';
  if (!body.expiresAt || Number.isNaN(new Date(body.expiresAt).getTime())) return 'Valid expiry date is required';
  if (new Date(body.expiresAt).getTime() <= Date.now()) return 'Expiry must be in the future';
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') return 'Invalid active status';
  return null;
};
exports.list = async (req,res) => {
 try { const coupons = await Coupon.find().sort({createdAt:-1}).lean(); res.json({coupons}); }
 catch(e) { console.error('List coupons:',e); res.status(500).json({message:'Failed to list coupons'}); }
};
exports.create = async (req,res) => {
 try {
  const body = {...req.body, code: normalize(req.body?.code)};
  const error=validate(body); if(error) return res.status(400).json({message:error});
  const coupon=await Coupon.create({code:body.code,discountType:'percentage',discountValue:body.discountValue,minimumPurchase:body.minimumPurchase,maximumDiscount:body.maximumDiscount,expiresAt:body.expiresAt,isActive:body.isActive ?? true});
  res.status(201).json({message:'Coupon created',coupon});
 } catch(e) { if(e.code===11000) return res.status(409).json({message:'Coupon code already exists'}); console.error('Create coupon:',e);res.status(500).json({message:'Failed to create coupon'}); }
};
exports.update = async (req,res) => {
 try {
  if(!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({message:'Invalid coupon ID'});
  const current=await Coupon.findById(req.params.id);
  if(!current) return res.status(404).json({message:'Coupon not found'});
  const allowed=['code','discountValue','minimumPurchase','maximumDiscount','expiresAt','isActive'];
  const merged=Object.fromEntries(allowed.map(k=>[k,req.body?.[k] === undefined ? current[k] : req.body[k]]));
  merged.code=normalize(merged.code);
  // Expired coupons can be disabled without forcing a new expiry date.
  const error=validate({...merged,expiresAt:merged.isActive ? merged.expiresAt : new Date(Date.now()+60000)});
  if(error) return res.status(400).json({message:error});
  Object.assign(current,merged);await current.save();
  res.json({message:'Coupon updated',coupon:current});
 } catch(e) { if(e.code===11000) return res.status(409).json({message:'Coupon code already exists'});console.error('Update coupon:',e);res.status(500).json({message:'Failed to update coupon'}); }
};
