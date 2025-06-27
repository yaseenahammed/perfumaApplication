const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
require('dotenv').config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          if (user.isBlocked) {
            console.log('Blocked Google user attempted login:', user.email);
            return done(null, false, { message: 'User is blocked by admin' });
          }
          console.log('Existing Google user found:', user.email);
          return done(null, user);
        }

        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          if (user.isBlocked) {
            console.log('Blocked user with email attempted Google login:', user.email);
            return done(null, false, { message: 'User is blocked by admin' });
          }
          user.googleId = profile.id;
          user.isVerified = true;
          await user.save();
          console.log('Updated user with Google ID:', user.email);
          return done(null, user);
        }

        // Create new user
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          isVerified: true,
          isAdmin: false,
          isBlocked: false,
        });

        await user.save();
        console.log('New Google user saved:', user.email);
        return done(null, user);
      } catch (error) {
        console.error('Error in Google Strategy:', error.stack);
        return done(error, null);
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