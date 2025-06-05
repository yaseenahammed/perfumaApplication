const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const env=require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google Profile:', profile); // Debug
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
            console.log('Existing user found:', user); // Debug
            return done(null, user);
        }else{
          user=new User({
            name:profile.displayName,
            email:profile.email[0].value,
            googleId:profile.id,
          })

          await user.save();
        console.log('New user saved:', user); // Debug
        return done(null, user);
        }

      

       
        
    } catch (error) {
        console.error('Error in Google Strategy:', error); // Debug
        return done(error, null);
    }
}));





passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id); // Debug
    done(null, user.id);
});

passport.deserializeUser( (id, done) => {

  User.findById(id)
  .then(user=>{
    done(null,user)
  })
  
  .catch (err=>{
        console.error('Error in deserializeUser:', err); // Debug
        done(err, null);
    })
});

module.exports = passport;