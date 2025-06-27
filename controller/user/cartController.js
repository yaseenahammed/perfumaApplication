const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');

const MAX_ALLOWED_QUANTITY = 5;

const getCart = async (req, res) => {
  try {
    const user = req.user;
    const cart = await Cart.findOne({ user: user._id }).populate('items.product');

    let subtotal = 0, shipping = 'Free', insurance = 5000, tax = 0;

    if (cart && cart.items.length > 0) {
      subtotal = cart.items.reduce((sum, item) => {
        const price = item.product.salePrice || item.product.regularPrice || 0;
        return sum + (price * item.quantity);
      }, 0);
      tax = subtotal * 0.12;
    }

    const total = subtotal + (shipping === 'Free' ? 0 : parseInt(shipping)) + insurance + tax;

    res.render('cart', {
      user,
      cartItems: cart?.items || [],
      subtotal,
      shipping,
      insurance,
      tax,
      total
    });
  } catch (error) {
    console.error('Error in getCart:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const productId = req.params.productId;

    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const itemIndex = cart.items.findIndex(i => i.product.toString() === productId);
    if (itemIndex === -1) return res.status(400).json({ error: 'Item not in cart' });

    cart.items.splice(itemIndex, 1);
    await cart.save();

    res.json({ success: true, message: 'Product removed from cart' });
  } catch (error) {
    console.error('Error in removeFromCart:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getCart,
  removeFromCart
};