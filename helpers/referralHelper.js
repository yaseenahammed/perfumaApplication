const crypto = require("crypto");
const User = require("../models/userSchema");
const Coupon = require("../models/couponSchema");

const handleReferralCoupon = async (referredBy) => {
  let referrerId = null;

  if (referredBy) {
    const referrer = await User.findOne({ referralToken: referredBy });

    if (referrer) {
      referrerId = referrer._id;

      const couponCode = `REF-${crypto
        .randomBytes(4)
        .toString("hex")
        .toUpperCase()}`;

      const coupon = new Coupon({
        couponCode,
        discountPrice: 100,
        minPrice: 1000,
        expireOn: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        isList: true,
        maxUsesPerUser: 1,
        userId: [referrer._id],
      });

      await coupon.save();
    }
  }

  return referrerId;
};

module.exports = { handleReferralCoupon };
