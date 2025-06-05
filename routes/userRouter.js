const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userController');
const productController = require('../controller/user/productController');
const passport = require('../config/passport');
const { userAuth } = require('../middlewares/auth');



// Routes
router.get('/', userController.loadHome);
router.get('/signup', userController.loadSignup);
router.post('/signup', userController.signup);
router.get('/verify-otp', (req, res) => {
  res.render('verify-otp', { title: 'Verify OTP', message: req.flash('message') });
});
router.post('/verify-otp', userController.verifyOtp);
router.post('/resend-otp', userController.resendOtp);
router.get('/pageNotFound', userController.pageNotFound);

// Google Auth
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/signup' }),
    (req, res) => {
     res.redirect('/');
    }
);




// Login/Logout
router.get('/login', userController.loadLogin);
router.post('/login', userController.login);
router.get('/logout', userAuth, userController.logout);

// Shop
router.get('/shop', userAuth,userController.loadShop);
router.post('/shop', userAuth,userController.searchProducts);

// Product Details
router.get('/productDetails', userAuth, productController.productDetails);

module.exports = router;