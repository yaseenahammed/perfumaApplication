const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addresSchema');
const Order=require('../../models/orderSchema')
const mongoose = require('mongoose');

const SHIPPING_FEE = 50;
const TAX_RATE = 0.12;

const calculateSummary = (cartItems) => {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTaxes = 0;

  cartItems.forEach(item => {
    const itemPrice = item.product.salePrice;
    const quantity = item.quantity;
    const itemTotalBeforeTax = itemPrice * quantity;

    const itemDiscount = 0;
    const itemTax = itemTotalBeforeTax * TAX_RATE;

    subtotal += itemTotalBeforeTax;
    totalDiscount += itemDiscount;
    totalTaxes += itemTax;
  });

  const finalTotal = subtotal + SHIPPING_FEE - totalDiscount + totalTaxes;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping: SHIPPING_FEE,
    discount: parseFloat(totalDiscount.toFixed(2)),
    tax: parseFloat(totalTaxes.toFixed(2)),
    total: parseFloat(finalTotal.toFixed(2))
  };
};

const getCheckout = async (req, res) => {
  try {
    const userId = req.session.userId;
    const addressDoc = await Address.findOne({ userId }).lean();
    const user = await User.findById(userId).lean();

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();

    if (!cart || cart.items.length === 0) {
      req.flash('info', 'Your cart is empty. Please continue shopping.');
      return res.redirect('/cart');
    }

    const validCartItems = [];
    let hasInvalidItems = false;

    for (const item of cart.items) {
      if (!item.product || !item.product.isListed || item.product.isBlocked || item.quantity > item.product.quantity) {
        hasInvalidItems = true;
      } else {
        validCartItems.push(item);
      }
    }

    if (hasInvalidItems) {
      req.flash('error', 'Some items in your cart are unavailable or out of stock. Please review your cart.');
      return res.redirect('/cart');
    }

    if (validCartItems.length === 0) {
      req.flash('info', 'Your cart is empty after removing unavailable items.');
      return res.redirect('/cart');
    }

    const summary = calculateSummary(validCartItems);

    const defaultAddress = (Array.isArray(addressDoc.addresses) && addressDoc.addresses.length > 0)
      ? addressDoc.addresses.find(addr => addr.isDefault) || addressDoc.addresses[0]
      : null;

    res.render('checkout', {
      title: 'Checkout',
      user: user,
      cartItems: validCartItems,
      userAddresses: addressDoc?.addresses || [],
      selectedAddress: defaultAddress,
      subtotal: summary.subtotal,
      shipping: summary.shipping,
      discount: summary.discount,
      tax: summary.tax,
      total: summary.total
    });

  } catch (error) {
    console.error('Error in checkout:', error);
    req.flash('error', 'Could not load checkout page. Please try again.');
    res.redirect('/pageNotFound');
  }
};

const addAddress = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { phone, street, city, state, zip, country } = req.body;

    const isDigitsOnly = /^\d+$/;
    if (!isDigitsOnly.test(phone) || phone.length !== 10) {
      return res.status(400).send("Invalid phone number");
    }

    if (!isDigitsOnly.test(zip) || zip.length !== 6) {
      return res.status(400).send("Invalid pincode");
    }

    const newAddress = { phone, street, city, state, zip, country };

    let userAddress = await Address.findOne({ userId });

    if (!userAddress) {
      userAddress = new Address({ userId, addresses: [newAddress] });
    } else {
      userAddress.addresses.push(newAddress);
    }

    await userAddress.save();
    res.redirect('/checkout');
  } catch (error) {
    console.error("Error in addAddress:", error);
    res.status(500).send("Internal Server Error");
  }
};

const editAddress = async (req, res) => {
  try {
    const { addressId, phone, street, city, state, zip, country } = req.body;
    const userId = req.session.userId;

    const isDigitsOnly = /^\d+$/;
    if (!isDigitsOnly.test(phone) || phone.length !== 10) {
      return res.status(400).send("Invalid phone number");
    }

    if (!isDigitsOnly.test(zip) || zip.length !== 6) {
      return res.status(400).send("Invalid pincode");
    }

    const addressDoc = await Address.findOne({ userId });

    if (!addressDoc) {
      return res.status(404).json({ message: "Address document not found" });
    }

    const index = addressDoc.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (index === -1) {
      return res.status(404).json({ message: "Address not found" });
    }

    addressDoc.addresses[index] = { phone, street, city, state, zip, country };

    await addressDoc.save();
    res.redirect('/checkout');
  } catch (error) {
    console.error("Error in editAddress:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const orderConfirm = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).lean();

    const orderId = req.params.orderId;
    const order = await Order.findById(orderId).populate('items.product').lean();

    if (!order) {
      req.flash('error', 'Order not found');
      return res.redirect('/shop');
    }

    res.render('order-confirmation', {
      user,
      order
    });
  } catch (error) {
    console.error('error in order details page', error);
    res.redirect('/pageNotFound');
  }
};



const placeOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const addressDoc = await Address.findOne({ userId });
    if (!addressDoc) {
      return res.status(400).json({ success: false, message: 'Invalid address' });
    }

    const selectedAddress = addressDoc.addresses.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'Selected address not found' });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const items = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.salePrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shipping = 499;
    const tax = 599;
    const discount = 0;
    const total = subtotal + shipping + tax - discount;

    const method = paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod;

    const order = new Order({
      user: user._id,
      address: selectedAddress,
      paymentMethod: method,
      items,
      subtotal,
      shipping,
      tax,
      discount,
      totalAmount: total,
      status: 'Confirmed',
    });

    await order.save();
    await Cart.findOneAndUpdate({ user: user._id }, { items: [] });

    res.status(200).json({ success: true, orderId: order._id });

  } catch (error) {
    console.error('Error placing order:', error.stack);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


   


module.exports = {
  getCheckout,
  addAddress,
  editAddress,
  orderConfirm,
  placeOrder
};
