const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userController');
const productController = require('../controller/user/productController');
const profileController = require('../controller/user/profileController');
const userProfileController=require('../controller/user/userProfileController')
const CartController=require('../controller/user/cartController')
const checkoutController=require('../controller/user/checkoutController')
const orderController=require('../controller/user/orderController')
const wishlistController=require('../controller/user/wishllistController')
const shopController=require('../controller/user/shopController')
const walletController=require('../controller/user/walletController')
const passport = require('../config/passport');
const uploads = require('../helpers/multer');
const nocache=require('nocache')
const { userAuth,isLogin,setUser} = require('../middlewares/auth');


// Routes
router.get('/',setUser,userController.loadHome);
router.get('/signup',isLogin, userController.loadSignup);
router.post('/signup', userController.signup);
router.get('/verify-otp', (req, res) => {
  res.render('verify-otp', { title: 'Verify OTP', message: req.flash('message') });
});
router.post('/verify-otp', userController.verifyOtp);

router.post('/resend-OTP', userController.resendOtp);
router.get('/pageNotFound', userController.pageNotFound);

// Google Auth
router.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);


router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google Auth Error:', err);
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


// Login/Logout
router.get('/login',nocache(),isLogin, userController.loadLogin);
router.post('/login', userController.login);
router.get('/logout', userAuth, userController.logout);

// Shop
router.get('/shop', setUser,shopController.loadShop);
router.post('/shop',setUser,shopController.searchProducts);

// Profile Management
router.get('/forgot-password', nocache(), isLogin, profileController.getForgotPassword);
router.post('/forgot-password', nocache(), isLogin, profileController.forgotEmailValid);
router.post('/verify-passForgot-otp', nocache(), isLogin, profileController.verifyForgotPassOtp);
router.get('/reset-password', nocache(), isLogin, profileController.getResetPassPage);
router.post('/reset-password', nocache(), isLogin, profileController.resetPassword);
router.post('/forget-resend-otp', nocache(), isLogin, profileController.resendOtp);



// Product Details
router.get('/productDetails',productController.productDetails);
router.post('/add-to-cart/:productId',userAuth,productController.addToCart);
router.post('/cart/add/:productId', userAuth, productController.incrementQuantity);
router.post('/cart/decrement/:productId', userAuth, productController.decrementQuantity);


//user profile
router.get('/userProfile',userAuth,userProfileController.userProfile)
router.get('/edit-profile',userAuth,userProfileController.getEditProfile)
router.post('/edit-profile',userAuth,uploads.single('profileImage'),userProfileController.updateProfile)
router.get('/user-address',userAuth,userProfileController.userAddress)
router.post('/add-address',userAuth,userProfileController.addAddress)
router.post('/edit-address', userAuth, userProfileController.editAddress);
router.post('/delete-address/:index', userAuth, userProfileController.deleteAddress);
router.post('/send-email-otp', userAuth, userProfileController.sendEmailOtp);
router.post('/verify-email-otp', userAuth, userProfileController.verifyEmailOtp);
router.post('/change-password', userAuth, userProfileController.changePassword);

//cart
router.get('/cart',userAuth,CartController.getCart);
router.delete('/cart/remove/:productId', userAuth,CartController.removeFromCart);

//checkout
router.get('/checkout',userAuth,checkoutController.getCheckout)
router.post('/addressAdd',userAuth,checkoutController.addAddress)
router.post('/addressEdit',userAuth,checkoutController.editAddress)
router.get('/order-details/:orderId', userAuth,checkoutController.orderConfirm);
router.post('/place-order',userAuth,checkoutController.placeOrder)
router.post('/create-order',userAuth,checkoutController.createRazorpayOrder)
router.post('/apply-coupon',userAuth,checkoutController.applyCoupon)
router.post('/select-address', userAuth, checkoutController.selectAddress);



//order
router.get('/my-orders',userAuth,orderController.getOrders)
router.post('/cancel-order/:orderID',userAuth, orderController.cancelOrder);
router.get('/userOrder-details/:orderID',userAuth,orderController.userOrderDetails)
router.post('/return-order/:orderID', userAuth, orderController.returnOrder);
// router.get('/download-invoice/:orderID', userAuth, orderController.downloadInvoice);


//whishlist
router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/wishlist/add/:productId', userAuth, wishlistController.addToWishlist);
router.post('/wishlist/remove/:productId', userAuth, wishlistController.removeFromWishlist);
router.post('/wishlist/clear',userAuth,wishlistController.clearWishlist)


//wallet
router.get('/wallet',userAuth,walletController.getWallet)
router.post('/wallet/create-walletOrder',userAuth,walletController.createWalletOrder)
router.post('/wallet/verify-walletOrder',userAuth,walletController.verifyWalletOrder)




module.exports = router;