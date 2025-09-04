const Coupon = require('../models/couponSchema');

async function validateCoupon({ couponCode, subtotal, userId, discountPrice, sessionCouponCode }) {
  if (!couponCode) {
    return { success: false, message: "Coupon code is required." };
  }

  if (sessionCouponCode && couponCode !== sessionCouponCode) {
    return { success: false, message: "Coupon code does not match the applied coupon." };
  }

  const coupon = await Coupon.findOne({ couponCode }).lean();
  if (!coupon) {
    return { success: false, message: "Coupon not found." };
  }

  if (!coupon.isList) {
    return { success: false, message: "Coupon is not listed." };
  }

  if (new Date(coupon.expireOn) < new Date()) {
    return { success: false, message: "Coupon has expired." };
  }

  if (coupon.minPrice > subtotal) {
    return { success: false, message: `Minimum order value of ₹${coupon.minPrice} required.` };
  }

  if (coupon.userId.length > 0 && !coupon.userId.some(id => id.toString() === userId.toString())) {
    return { success: false, message: "Coupon not applicable to this user." };
  }

  if (discountPrice && parseFloat(discountPrice) !== coupon.discountPrice) {
    return { success: false, message: "Invalid discount price." };
  }

  const userUsage = coupon.usedBy.find(u => u.userId.toString() === userId.toString());
  if (userUsage && userUsage.count >= coupon.maxUsesPerUser) {
    return {
      success: false,
      message: `This coupon can only be used ${coupon.maxUsesPerUser} times per user. You already used it.`
    };
  }

  return {
    success: true,
    finalDiscountPrice: coupon.discountPrice,
    appliedCouponCode: coupon.couponCode
  };
}

module.exports = { validateCoupon };
