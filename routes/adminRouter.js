
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer'); 

const adminController = require('../controller/admin/adminController');
const customerController = require('../controller/admin/customerController');
const categoryController = require('../controller/admin/categoryController');
const brandController = require('../controller/admin/brandController'); 
const productController = require('../controller/admin/productController');
const { adminAuth } = require("../middlewares/auth");

// Import storage from multer.js helper
const storage = require('../helpers/multer');
const uploads = multer({ storage: storage });

// Routes
router.get('/pageError', adminController.pageError);

// Login (No auth needed)
router.get('/login', adminController.loadLogin);
router.post('/login', adminController.login);

// Protected routes with adminAuth middleware
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout', adminAuth, adminController.logout);

// Customer
router.get('/users', adminAuth, customerController.customerInfo);
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
router.get('/blockBrand', adminAuth, brandController.blockBrand);
router.get('/unblockBrand', adminAuth, brandController.unblockBrand);
router.get('/deleteBrand', adminAuth, brandController.deleteBrand);

// Product
router.get('/addProducts',productController.getAddProduct);
router.post('/addProducts', uploads.array("productImages", 4), productController.addProduct);
router.get('/products',  productController.getAllproducts);
router.get('/editProduct/:id', productController.getEditProduct);
router.post('/editProduct/:id',  uploads.array("productImages", 4), productController.postEditProduct);
router.post('/products/:id/remove-image',  productController.removeProductImage);
router.post('/products/:id/add-offer', productController.addOffer);
router.post('/products/:id/remove-offer',  productController.removeOffer);
router.get('/products/:id/block', productController.blockProduct);
router.get('/products/:id/unblock',  productController.unblockProduct);




module.exports = router;
