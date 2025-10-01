const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const { getBestPrice } = require('../../helpers/offerHelper');
const Brand = require('../../models/brandSchema');
const logger = require('../../helpers/logger');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.userId;
    let userData = null;

    if (userId && mongoose.isValidObjectId(userId)) {
      userData = await User.findById(userId).lean();
    }

    if (userId && !mongoose.isValidObjectId(userId)) {
      req.flash('error', 'Invalid session data');
      return res.redirect('/login');
    }

    if (userData && userData.isBlocked) {
      userData = null;
    }

    const productId = req.query.id;
    if (!productId || !mongoose.isValidObjectId(productId)) {
      req.flash('error', 'Invalid product ID');
      return res.redirect('/shop');
    }

    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand')
      .lean();

    if (!product || product.isBlocked|| product.brand.isBlocked || !product.category.isListed) {
      req.flash('error', 'Product not found');
      return res.redirect('/shop');
    }

    

 
    const { finalPrice, bestOffer } = await getBestPrice(product);
    product.finalPrice = finalPrice;
    product.bestOffer = bestOffer;

    const similarProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: { $in: ['available', 'discounted'] },
    }).limit(4).lean();

  
    const categoryOffer = product.category?.offer || 0;
    const productOffer = product.offer || 0;
    const totalOffer = categoryOffer + productOffer;

  
    let wishlistItems = [];
    if (userId) {
      const wishlist = await Wishlist.find({ user: userId }).populate('product');
      wishlistItems = wishlist.map(item => ({
        product: {
          _id: item.product._id,
          name: item.product.name,
          salePrice: item.product.salePrice,
          productImages: item.product.productImages,
        },
      }));
    }

    
    res.render('product-details', {
      title:'productDetails',
      product,
      similarProducts,
      user: userData,
      quantity: product.quantity,
      MAX_ALLOWED_QUANTITY,
      totalOffer,
      category: product.category,
      error: req.flash('error')[0] || null,
      wishlistItems,

    });

  } catch (error) {
    logger.error('Error in productDetails:', error.stack);
    req.flash('error', 'Unable to load product details');
    res.redirect('/shop');
  }
};








const MAX_ALLOWED_QUANTITY = 5;


const addToCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;
    const quantity = parseInt(req.body.quantity) || 1;
  

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    


 const product = await Product.findById(productId).populate('category');


    if (
      !product ||
      product.isBlocked ||
      !product.isListed ||
      product.quantity <= 0 ||
      !product.category ||
      product.category.isBlocked ||
      !product.category.isListed
    ) {
      return res.status(400).json({ error: 'Product cannot be added to cart' });
    }
if (quantity < 1) {
  return res.status(400).json({ error: 'Quantity must be at least 1' });
}

if (quantity > product.quantity) {
  return res.status(400).json({ error: 'Quantity exceeds available stock' });
}

if (quantity > MAX_ALLOWED_QUANTITY) {
  return res.status(400).json({ error: `Maximum ${MAX_ALLOWED_QUANTITY} quantity allowed per product` });
}


    const price = product.salePrice || product.regularPrice;
    const totalPrice = price * quantity;

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {
      return res.status(400).json({ error: 'Product already in cart' });

    } else {
      cart.items.push({
        product: productId,
        quantity,
        price,
        totalPrice
      });
    }


    await cart.save();

    const cartItemCount=cart.items.length

    await Wishlist.findOneAndDelete({
  user: userId,
  product: productId
});


    res.json({ success: true,
       message: 'Product added to cart',
       cartItemCount
       });
  } catch (error) {
    logger.error('Error in addToCart:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
};


module.exports = {
  productDetails,
  addToCart,
  
};