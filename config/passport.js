const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const User = require('../models/userSchema');
const { handleReferralCoupon } = require('../helpers/referralHelper');
require('dotenv').config();

const callbackURL =
  process.env.NODE_ENV === 'production'
    ? process.env.GOOGLE_CALLBACK_URL_PROD
    : process.env.GOOGLE_CALLBACK_URL_LOCAL;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // 1️⃣ Already Google user
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // 2️⃣ Email exists → link Google
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          return done(null, user);
        }

        // 3️⃣ BRAND NEW USER → REFERRAL COUPON
        let referrerId = null;

        if (req.session && req.session.referredBy) {
          referrerId = await handleReferralCoupon(req.session.referredBy);
        }

        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          isVerified: true,
          isBlocked: false,
          referredBy: referrerId,
        });

        await user.save();

        // clear referral AFTER success
        req.session.referredBy = null;

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// REQUIRED
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

module.exports = passport;
