const mongoose = require('mongoose');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');

const getWishlist = async (req, res) => {
  try {
  const user = req.user
    
    
    if (!user) {
      return res.status(401).send( { message: 'Please log in to view your wishlist' });
    }

    const wishlist = await Wishlist.find({ user:user._id }).populate('product');
    const wishlistItems = wishlist.map(item => ({
      _id: item._id,
    product: {
  _id: item.product._id,
  name: item.product.name,
  salePrice: item.product.salePrice,
  productImages: item.product.productImages,
}

    }));

    res.render('wishlist', {
     user,
      wishlistItems,
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).send({ message: 'Failed to load wishlist' });
  }
};

const addToWishlist = async (req, res) => {
   
  try {
      if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'User not logged in' });
    }

    const userId = req.session.user._id;
    const productId = req.params.productId;
   

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Please log in to add to wishlist' });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== 'available' || product.quantity <= 0) {
      return res.status(400).json({ success: false, error: 'Product not available' });
    }

    const existingItem = await Wishlist.findOne({user:userId,product:productId });
    if (existingItem) {
      return res.status(400).json({ success: false, error: 'Product already in wishlist' });
    }

    await Wishlist.create({ user:userId,product: productId });
    res.json({ success: true });
 

  } catch (err) {
    console.error('Error adding to wishlist:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }
    res.status(500).json({ success: false, error: 'Failed to add to wishlist' });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
  
    const userId = req.session.user._id;
   

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Please log in to remove from wishlist' });
    }

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }

    const wishlistItem = await Wishlist.findOneAndDelete({ user:userId, product:productId });
    if (!wishlistItem) {
      return res.status(404).json({ success: false, error: 'Item not found in wishlist' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing wishlist item:', err);
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, error: 'Invalid product ID' });
    }
    res.status(500).json({ success: false, error: 'Failed to remove from wishlist' });
  }
};

const clearWishlist = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Please log in to clear wishlist' });
    }

    await Wishlist.deleteMany({ user:userId });
    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing wishlist:', err);
    res.status(500).json({ success: false, error: 'Failed to clear wishlist' });
  }
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
};