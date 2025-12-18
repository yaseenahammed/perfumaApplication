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
        let user = await User.findOne({ googleId: profile.id });

        // Existing Google user
        if (user) {
          if (user.isBlocked) {
            return done(new Error('User is blocked by admin'));
          }
          return done(null, user);
        }

        // Existing email user → link Google
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          if (user.isBlocked) {
            return done(new Error('User is blocked by admin'));
          }
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          return done(null, user);
        }

        // New Google signup with referral
        let referrerId = null;
        if (req.session?.referredBy) {
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
        delete req.session.referredBy;

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// REQUIRED – prevents serialize error
passport.serializeUser((user, done) => {
  if (!user || !user._id) {
    return done(new Error('Invalid user'));
  }
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (user && user.isBlocked) {
      return done(new Error('User is blocked'));
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
