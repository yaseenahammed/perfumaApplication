const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');

const productDetails = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      req.flash('error', 'Please log in to view product details');
      return res.redirect('/login');
    }

    const userData = await User.findById(userId);
    if (!userData) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }

    const productId = req.query.id;
    if (!productId) {
      req.flash('error', 'Product ID is required');
      return res.redirect('/shop');
    }

    const product = await Product.findById(productId)
      .populate('category')
      .populate('brand');
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/shop');
    }

    // Fetch similar products after product is defined
    const similarProducts = await Product.find({
      category: product.category._id, // Match products with the same category ID
      _id: { $ne: product._id }, // Exclude the current product
      status: { $in: ['available', 'discounted'] } // Only include available or discounted products
    }).limit(4);

    const findCategory = product.category;
    const categoryOffer = findCategory?.offer || 0;
    const productOffer = product.offer || 0;
    const totalOffer = categoryOffer + productOffer;

    res.render('product-details', {
      product,
      similarProducts,
      user: userData,
      quantity: product.quantity,
      totalOffer,
      category: findCategory
    });
  } catch (error) {
    console.error('Error in productDetails:', error);
    req.flash('error', 'Unable to load product details');
    res.redirect('/shop');
  }
};

module.exports = {
  productDetails
};