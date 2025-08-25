const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const { getBestPrice } = require('../../helpers/offerHelper');

const MAX_ALLOWED_QUANTITY = 5;
const SHIPPING_FEE = 50;

const calculateSummary = async (cartItems) => {
  let subtotal = 0;
  for (const item of cartItems) {
    const { finalPrice } = await getBestPrice(item.product); 
    item.product.finalPrice = finalPrice;
    subtotal += finalPrice * item.quantity;
  }

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping: SHIPPING_FEE,
    total: parseFloat((subtotal + SHIPPING_FEE).toFixed(2))
  };
};

const isItemBlocked = (item) => {
  return (
    !item.product ||
    !item.product.isListed ||
    item.product.isBlocked ||
    (item.product.brand && item.product.brand.isBlocked) ||
    (item.product.category && !item.product.category.isListed) ||
    item.quantity > item.product.quantity
  );
};

const getCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        populate: [
          { path: 'brand', select: 'name isBlocked' },
          { path: 'category', select: 'isListed isBlocked' } 
        ]
      })
      .lean();

    if (!cart || !cart.items.length) {
      return res.render('cart', {
        user,
        cartItems: [],
        subtotal: 0,
        shipping: SHIPPING_FEE,
        total: SHIPPING_FEE,
        cartItemCount: 0,
        disableCheckout: true,
        validItems: []
      });
    }

    const validCartItems = [];
    const allCartItems = [];

    for (const item of cart.items) {
      const isBlocked = isItemBlocked(item);
      if (!isBlocked) {
        const { finalPrice } = await getBestPrice(item.product);
        item.product.finalPrice = finalPrice;
        validCartItems.push(item);
      }
      allCartItems.push({ ...item, isBlocked });
    }

    const disableCheckout = validCartItems.length === 0;
    const summary = await calculateSummary(validCartItems);

    res.render('cart', {
      user,
      cartItems: allCartItems,
      subtotal: summary.subtotal,
      shipping: summary.shipping,
      total: summary.total,
      cartItemCount: cart.items.length,
      disableCheckout,
      validItems: validCartItems
    });
  } catch (error) {
    console.error('Error loading cart:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const incrementQuantity = async (req, res) => {
  try {
    const { productId } = req.body;
    console.log('Increment req.body:', req.body);
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        populate: [
          { path: 'brand', select: 'isBlocked' },
          { path: 'category', select: 'isListed isBlocked' }
        ]
      });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const cartItem = cart.items.find(
      (item) => item.product && item.product._id.toString() === productId
    );

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    if (isItemBlocked(cartItem)) {
      return res.status(400).json({ success: false, message: 'This item is unavailable' });
    }

    if (cartItem.quantity >= cartItem.product.quantity) {
      return res.status(400).json({ success: false, message: 'No more stock available' });
    }

    if (cartItem.quantity >= MAX_ALLOWED_QUANTITY) {
      return res.status(400).json({ success: false, message: 'Maximum quantity reached' });
    }

    cartItem.quantity += 1;
    await cart.save();

    let subtotal = 0;
    for (let item of cart.items) {
      if (!isItemBlocked(item)) {
        const { finalPrice } = await getBestPrice(item.product);
        item.totalPrice = finalPrice * item.quantity;
        subtotal += item.totalPrice;
      }
    }

    const disableCheckout = !cart.items.some((item) => !isItemBlocked(item));

    res.json({
      success: true,
      updatedQuantity: cartItem.quantity,
      productQuantity: cartItem.product.quantity,
      subtotal: parseFloat(subtotal.toFixed(2)),
      total: parseFloat((subtotal + SHIPPING_FEE).toFixed(2)),
      shipping: SHIPPING_FEE,
      cartItemCount: cart.items.length,
      disableCheckout
    });
  } catch (error) {
    console.error('Increment Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const decrementQuantity = async (req, res) => {
  try {
    const { productId } = req.body;
    console.log('Decrement req.body:', req.body); 
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        populate: [
          { path: 'brand', select: 'isBlocked' },
          { path: 'category', select: 'isListed isBlocked' }
        ]
      });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const cartItem = cart.items.find(
      (item) => item.product && item.product._id.toString() === productId
    );

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Product not in cart' });
    }

    if (isItemBlocked(cartItem)) {
      return res.status(400).json({ success: false, message: 'This item is unavailable' });
    }

    if (cartItem.quantity <= 1) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be less than 1' });
    }

    cartItem.quantity -= 1;
    await cart.save();

    let subtotal = 0;
    for (let item of cart.items) {
      if (!isItemBlocked(item)) {
        const { finalPrice } = await getBestPrice(item.product);
        item.totalPrice = finalPrice * item.quantity;
        subtotal += item.totalPrice;
      }
    }

    const disableCheckout = !cart.items.some((item) => !isItemBlocked(item));

    res.json({
      success: true,
      updatedQuantity: cartItem.quantity,
      productQuantity: cartItem.product.quantity,
      subtotal: parseFloat(subtotal.toFixed(2)),
      total: parseFloat((subtotal + SHIPPING_FEE).toFixed(2)),
      shipping: SHIPPING_FEE,
      cartItemCount: cart.items.length,
      disableCheckout
    });
  } catch (error) {
    console.error('Decrement Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { productId } = req.body; 
    console.log('Remove req.body:', req.body); 
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: 'items.product',
        populate: [
          { path: 'brand', select: 'isBlocked' },
          { path: 'category', select: 'isListed isBlocked' }
        ]
      });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(i => i.product && i.product._id.toString() === productId);
    if (itemIndex === -1) {
      return res.status(400).json({ success: false, message: 'Item not in cart' });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();

    let subtotal = 0;
    for (let cartItem of cart.items) {
      if (!isItemBlocked(cartItem)) {
        const { finalPrice } = await getBestPrice(cartItem.product);
        cartItem.totalPrice = finalPrice * cartItem.quantity;
        subtotal += cartItem.totalPrice;
      }
    }

    const shipping = cart.items.length > 0 ? SHIPPING_FEE : 0;
    const total = parseFloat((subtotal + shipping).toFixed(2));
    const cartItemCount = cart.items.length;

    const hasUnavailableItems = cart.items.some(item => isItemBlocked(item));

    res.json({
      success: true,
      subtotal: parseFloat(subtotal.toFixed(2)),
      shipping,
      total,
      cartItemCount,
      hasUnavailableItems,
      disableCheckout: hasUnavailableItems || cartItemCount === 0
    });
  } catch (error) {
    console.error('Error in removeFromCart:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getCart,
  incrementQuantity,
  decrementQuantity,
  removeFromCart
};