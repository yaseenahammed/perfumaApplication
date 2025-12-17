const express = require('express');
const router = express.Router();
const userController = require('../controller/user/userController');
const productController = require('../controller/user/productController');
const profileController = require('../controller/user/profileController');
const userProfileController=require('../controller/user/userProfileController')
const cartController=require('../controller/user/cartController')
const checkoutController=require('../controller/user/checkoutController')
const orderController=require('../controller/user/orderController')
const wishlistController=require('../controller/user/wishllistController')
const shopController=require('../controller/user/shopController')
const walletController=require('../controller/user/walletController')
const contactController=require('../controller/user/contactController')
const uploads = require('../helpers/multer');
const passport = require('../config/passport');

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

// Login/Logout
router.get('/login',nocache(),isLogin, userController.loadLogin);
router.post('/login', userController.login);
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', userController.googleCallback);
router.get('/logout', userAuth, userController.logout);

// Shop
router.get('/shop', setUser,shopController.loadShop);
router.post('/shop',setUser,shopController.searchProducts);

router.get('/about',setUser,contactController.getAbout)
router.get('/contact',setUser,contactController.getContact)
router.post('/contact',setUser,contactController.postContact)

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
router.get('/cart',userAuth,cartController.getCart);
router.post('/cart/add/:productId', userAuth, cartController.incrementQuantity);
router.post('/cart/decrement/:productId', userAuth, cartController.decrementQuantity);
router.delete('/cart/remove/:productId', userAuth,cartController.removeFromCart);

//checkout 
router.get('/checkout',userAuth,checkoutController.getCheckout)
router.post('/addressAdd',userAuth,checkoutController.addAddress)
router.post('/addressEdit',userAuth,checkoutController.editAddress)
router.get('/order-details/:orderId', userAuth,checkoutController.orderConfirm);
router.post('/place-order',userAuth,checkoutController.placeOrder)
router.post('/create-order',userAuth,checkoutController.createRazorpayOrder)
router.post('/retry-payment',userAuth,checkoutController.retryPayment)
router.post('/verify-payment',userAuth,checkoutController.verifyPayment)
router.post('/apply-coupon',userAuth,checkoutController.applyCoupon)
router.post('/checkout/coupon/remove',userAuth,checkoutController.removeCoupon)
router.post('/select-address', userAuth, checkoutController.selectAddress);

//order
router.get('/my-orders',userAuth,orderController.getOrders)
router.post('/cancel-order/:orderID',userAuth, orderController.cancelOrder);
router.post('/cancel-item/:orderID/:itemID',userAuth, orderController.cancelItem);
router.get('/userOrder-details/:orderID',userAuth,orderController.userOrderDetails)
router.get('/userOrder-details', userAuth,orderController.userOrderDetails);
router.post('/return-order/:orderID', userAuth, orderController.returnOrder);
router.post('/return-item/:orderID/:itemID',userAuth, orderController.returnItem);
router.get('/download-invoice/:orderID', userAuth, orderController.downloadInvoice);


//whishlist
router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/wishlist/add/:productId', userAuth, wishlistController.addToWishlist);
router.post('/wishlist/remove/:productId', userAuth, wishlistController.removeFromWishlist);
router.post('/wishlist/clear',userAuth,wishlistController.clearWishlist)


//wallet
router.get('/wallet',userAuth,walletController.getWallet)
router.post('/wallet/create-walletOrder',userAuth,walletController.createWalletOrder)
router.post('/wallet/verify-walletOrder',userAuth,walletController.verifyWalletOrder)
router.get('/wallet/transaction-filter',userAuth,walletController.filterTransaction)
router.get('/wallet/transactions', userAuth,walletController.getAllTransactions);

module.exports = router;