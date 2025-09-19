const User=require('../models/userSchema')
const Cart = require('../models/cartSchema'); 
const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const logger = require('../helpers/logger');


// Google Auth
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);


router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      logger.error('Google Auth Error:', err);
      return next(err);
    }

    if (!user) {
     
      const errorMessage = info && info.message ? info.message : 'Google login failed';
      return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
    }

    req.logIn(user, (err) => {
      if (err) return next(err);
      req.session.userId = user._id;
      return res.redirect('/');
    });
  })(req, res, next);
});


const userAuth = async (req, res, next) => {
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();

      if (user && !user.isBlocked) {
        req.user = user;
        return next(); 
      } else {
     
        if (user && user.isBlocked) {
          req.flash('error', 'Your account is blocked'); 
        }
        req.session.destroy(() => {
          return res.redirect('/login'); 
        });
      }
    } catch (err) {
      logger.error(err);
      req.session.destroy(() => {
    
        return res.redirect('/login');
      });
    }
  } else {
    req.flash('error', 'Please log in to continue');
    return res.redirect('/login');
  }
};


const isLogin = async (req, res, next) => {
  if (req.session.userId) {
    const user = await User.findById(req.session.userId).lean();
    if (!user || user.isBlocked) {
      req.session.destroy(() => res.redirect('/login'));
      return;
    }
    return res.redirect('/');
  }
  next();
};





const setUser = async (req, res, next) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId).lean();

      if (!user || user.isBlocked) {
        req.session.destroy(() => {});
        res.locals.user = null;

         return res.redirect('/');
      } else {
        res.locals.user = user;
      }
    } else {
      res.locals.user = null;
    }
  } catch (err) {
    logger.error('setUser middleware error:', err);
    res.locals.user = null;
  }

  next();
};





const adminAuth = async (req, res, next) => {


  try {
    if (req.session.admin) {
      const admin = await User.findById(req.session.admin);

      if (admin && admin.isAdmin && !admin.isBlocked) {
        return next();
      } else {
        return res.redirect('/admin/login');
      }
    } else {
      return res.redirect('/admin/login');
    }
  } catch (error) {
    logger.info("Error in admin auth middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};


const isAdmin=async (req,res,next)=>{
  try {
    const admin=req.session.admin
    if(admin){
      return res.redirect('/admin/dashboard')
    }
    next()
  } catch (error) {
    logger.error('error in middleware',error)
  }
}





const cartMiddleware = async (req, res, next) => {
  try {
    res.locals.cartItemCount = 0;

    if (req.session.userId) {
      const cart = await Cart.findOne({ user: req.session.userId }).lean();
      
      if (cart && cart.items.length > 0) {
        const totalQuantity = cart.items.length
        res.locals.cartItemCount = totalQuantity;
      }
    }

    next();
  } catch (error) {
    logger.error('Cart Middleware Error:', error);
    next();
  }
};




module.exports={
     router,
    userAuth,
    isLogin,
    adminAuth,
    isAdmin,
    setUser,
    cartMiddleware
}