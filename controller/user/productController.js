const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');

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

 if (!userData) {
 
  userData = null;
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
  

    if (!product) {
      req.flash('error', 'Product not found');
      
      return res.redirect('/shop');
    }

    const similarProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      status: { $in: ['available', 'discounted'] },
    }).limit(4).lean();
  

    const findCategory = product.category;
    const categoryOffer = findCategory?.offer || 0;
    const productOffer = product.offer || 0;
    const totalOffer = categoryOffer + productOffer;

    let wishlistItems = [];
if (req.session.userId) {
  const wishlist = await Wishlist.find({ user: req.session.userId }).populate('product');
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
      product,
      similarProducts,
      user: userData,
      quantity: product.quantity,
      totalOffer,
      category: findCategory,
      error: req.flash('error')[0] || null,
      wishlistItems
    });
  } catch (error) {
    console.error('Error in productDetails:', error.stack);
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

    if (quantity < 1 || quantity > product.quantity || quantity > MAX_ALLOWED_QUANTITY) {
      return res.status(400).json({ error: 'Invalid quantity selected' });
    }

    const price = product.salePrice || product.regularPrice;
    const totalPrice = price * quantity;

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {
      const newQuantity = cart.items[itemIndex].quantity + quantity;
      if (newQuantity > product.quantity || newQuantity > MAX_ALLOWED_QUANTITY) {
        return res.status(400).json({ error: 'Maximum quantity reached' });
      }
      cart.items[itemIndex].quantity = newQuantity;
      cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price,
        totalPrice
      });
    }

    await Wishlist.updateOne({ user: userId }, { $pull: { items: productId } });
    await cart.save();

    res.json({ success: true, message: 'Product added to cart' });
  } catch (error) {
    console.error('Error in addToCart:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const incrementQuantity = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    const cart = await Cart.findOne({ user: userId });
    const product = await Product.findById(productId).populate('category');

    if (!cart || !product) return res.status(404).json({ error: 'Not found' });

    const item = cart.items.find(i => i.product.toString() === productId);
    if (!item) return res.status(400).json({ error: 'Item not in cart' });

    if (
      product.isBlocked ||
      !product.isListed ||
      product.quantity <= 0 ||
      product.category.isBlocked ||
      !product.category.isListed
    ) {
      return res.status(400).json({ error: 'Product is not available' });
    }

    if (item.quantity >= product.quantity || item.quantity >= MAX_ALLOWED_QUANTITY) {
      return res.status(400).json({ error: 'Maximum quantity reached' });
    }

    item.quantity += 1;
    item.totalPrice = item.quantity * item.price;
    await cart.save();

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal; 
    const cartItemsLength = cart.items.length;

    res.json({
      success: true,
      updatedQuantity: item.quantity,
      subtotal: subtotal,
      total: total,
      cartItemsLength: cartItemsLength,
    });
  } catch (err) {
    console.error('Increment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

const decrementQuantity = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(i => i.product.toString() === productId);
    if (!item) return res.status(400).json({ error: 'Item not in cart' });

    if (item.quantity <= 1) {
      return res.status(400).json({ error: 'Minimum quantity is 1' });
    }

    item.quantity -= 1;
    item.totalPrice = item.quantity * item.price;
    await cart.save();

    const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = subtotal; 
    const cartItemsLength = cart.items.length;

    res.json({
      success: true,
      updatedQuantity: item.quantity,
      subtotal: subtotal,
      total: total,
      cartItemsLength: cartItemsLength,
    });
  } catch (err) {
    console.error('Decrement error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  productDetails,
  addToCart,
  incrementQuantity,
  decrementQuantity
};