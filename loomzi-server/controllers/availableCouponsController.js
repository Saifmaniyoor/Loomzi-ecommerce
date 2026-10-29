const Coupon=require('../models/Coupon');
const {calculateCartSummary}=require('../utils/cartCalculator');
exports.availableCoupons=async(req,res)=>{
 try {
  const userId=req.user?._id;
  if(!userId) return res.status(401).json({message:'Please login first'});
  const cart=await calculateCartSummary(userId);
  const coupons=await Coupon.find({isActive:true,expiresAt:{$gt:new Date()}}).sort({minimumPurchase:1,discountValue:-1}).lean();
  res.json({subtotal:cart.subtotal,coupons:coupons.map(c=>({code:c.code,discountType:c.discountType,discountValue:c.discountValue,minimumPurchase:c.minimumPurchase,maximumDiscount:c.maximumDiscount,expiresAt:c.expiresAt,eligible:!cart.hasUnavailableItems && cart.items.length>0 && cart.subtotal>=c.minimumPurchase}))});
 } catch(e){console.error('Available coupons:',e);res.status(500).json({message:'Could not load coupons'});}
};
