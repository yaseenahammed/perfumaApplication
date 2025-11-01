const GoogleStrategy = require('passport-google-oauth20').Strategy;
const passport = require('passport');
const User = require('../models/userSchema');
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
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          if (user.isBlocked) return done(null, false, { message: 'User is blocked by admin' });
          return done(null, user);
        }

       
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          if (user.isBlocked) return done(null, false, { message: 'User is blocked by admin' });
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          return done(null, user);
        }

    
        user = new User({
  name: profile.displayName,
  email: profile.emails[0].value,
  googleId: profile.id,
  isVerified: true,
  isBlocked: false,
});

        await user.save();
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);


passport.serializeUser((user, done) => {
  console.log('Serializing user:', user._id);
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (user && user.isBlocked) {
      console.log('Blocked user in deserializeUser:', user.email);
      return done(null, false, { message: 'User is blocked by admin' });
    }
    done(null, user);
  } catch (err) {
    console.error('Error in deserializeUser:', err.stack);
    done(err, null);
  }
});

module.exports = passport;