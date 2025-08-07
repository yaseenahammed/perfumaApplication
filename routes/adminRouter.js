


const express = require('express');
const router = express.Router();

const uploads = require('../helpers/multer'); 
 

const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const brandController = require('../controller/admin/brandController'); 
const productController = require('../controller/admin/productController');
const orderManageController=require('../controller/admin/orderManageController')
const couponManageController=require('../controller/admin/couponManageController')
const salesController=require('../controller/admin/salesController')
const nocache=require('nocache')
const { adminAuth,isAdmin} = require("../middlewares/auth");




router.get('/pageError', adminController.pageError);

// Login 
router.get('/login',nocache(),isAdmin, adminController.loadLogin);
router.post('/login', adminController.login);

//dashboard
router.get('/dashboard', adminAuth, adminController.loadDashboard);
router.get('/logout', adminAuth, adminController.logout);

// Customer
router.get('/users', customerController.customerInfo);
router.get('/blockCustomer', adminAuth, customerController.blockCustomer);
router.get('/unblockCustomer', adminAuth, customerController.unblockCustomer);

// Category
router.get('/category', adminAuth, categoryController.categoryInfo);
router.post('/addCategory', adminAuth, categoryController.addCategory);
router.post('/add-offer', adminAuth, categoryController.addOffer);
router.post('/remove-offer', adminAuth, categoryController.removeOffer);
router.post('/list-category', adminAuth, categoryController.listCategory);
router.get('/editCategory', adminAuth, categoryController.getEditCategory);
router.post('/editCategory', adminAuth, categoryController.editCategory);

// Brand
router.get('/brands', adminAuth, brandController.getBrandPage); 
router.post('/addBrand', adminAuth, uploads.single("image"), brandController.addBrand);
router.post('/blockBrand', adminAuth, brandController.blockBrand);
router.post('/unblockBrand', adminAuth, brandController.unblockBrand);
router.post('/deleteBrand', adminAuth, brandController.deleteBrand);

// Product
router.get('/products', adminAuth,  productController.getAllproducts);
router.get('/editProduct/:id', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id',  adminAuth, uploads.array("productImages", 4), productController.postEditProduct);
router.get('/addProducts', adminAuth,productController.getAddProduct);
router.post('/addProducts', adminAuth, uploads.array("productImages", 4), productController.addProduct);
router.post('/products/:id/remove-image',  adminAuth, productController.removeProductImage);
router.post('/products/:id/add-offer', adminAuth, productController.addOffer);
router.post('/products/:id/remove-offer',  adminAuth, productController.removeOffer);
router.post('/products/:id/block', adminAuth, productController.blockProduct);
router.post('/products/:id/unblock', adminAuth,  productController.unblockProduct);

//order
router.get('/orderList',adminAuth,orderManageController.orderListing)
router.post('/update-status/:orderId',adminAuth,orderManageController.updateStatus)
router.post('/verify-return/:orderID',adminAuth,orderManageController.verifyReturn)
router.post('/reject-return/:orderID',adminAuth,orderManageController.rejectReturn)
router.get('/order-details/:orderID',adminAuth,orderManageController.orderDetails)


//coupon
router.get('/coupon',adminAuth,couponManageController.getCoupon)
router.post('/create-coupon',adminAuth,couponManageController.addCoupon)
router.post('/update-coupon/:couponCode',adminAuth,couponManageController.updateCoupon)
router.post('/delete-coupon/:couponCode',adminAuth,couponManageController.deleteCoupon)

//salesReport
router.get('/sales-report',adminAuth,salesController.getSalesReport)







module.exports = router;
