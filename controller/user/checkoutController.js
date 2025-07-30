const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addresSchema');
const Order=require('../../models/orderSchema')
const mongoose = require('mongoose');
const Razorpay = require('razorpay');



const SHIPPING_FEE = 50;


const calculateSummary = (cartItems) => {
  let subtotal = 0;


  cartItems.forEach(item => {
    const itemPrice = item.product.salePrice;
    const quantity = item.quantity;
    const itemTotalBeforeTax = itemPrice * quantity;

   
    subtotal += itemTotalBeforeTax;


  });

  const total = subtotal + SHIPPING_FEE

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping: SHIPPING_FEE,
   total
   
  };
};

const getCheckout = async (req, res) => {
  console.log('checkout triggered');

  try {
    const userId = req.session.userId;

    const user = await User.findById(userId).lean();
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }

    const addressDoc = await Address.findOne({ userId }).lean(); 

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

 
    const addresses = addressDoc?.addresses || [];
    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0] || null;

    res.render('checkout', {
      title: 'Checkout',
      user: user,
      cartItems: validCartItems,
      userAddresses: addresses,
      selectedAddress: defaultAddress,
      subtotal: summary.subtotal,
      shipping: summary.shipping,
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
    const isValidText = (text) => typeof text === 'string' && text.trim() !== '' && !/[^\w\s\-.,]/.test(text); // blocks symbols

  
    if (!isDigitsOnly.test(phone) || phone.length !== 10 || /^0+$/.test(phone)) {
      return res.status(400).send("Invalid phone number");
    }

    if (!isDigitsOnly.test(zip) || zip.length !== 6 || /^0+$/.test(zip)) {
      return res.status(400).send("Invalid pincode");
    }


    const fieldsToValidate = [street, city, state, country];
    if (!fieldsToValidate.every(isValidText)) {
      return res.status(400).send("Invalid characters in address fields");
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
    const isValidText = (text) => typeof text === 'string' && text.trim() !== '' && !/[^\w\s\-.,]/.test(text); // no special chars

    if (!isDigitsOnly.test(phone) || phone.length !== 10 || /^0+$/.test(phone)) {
      return res.status(400).send("Invalid phone number");
    }

    if (!isDigitsOnly.test(zip) || zip.length !== 6 || /^0+$/.test(zip)) {
      return res.status(400).send("Invalid pincode");
    }

    const fieldsToValidate = [street, city, state, country];
    if (!fieldsToValidate.every(isValidText)) {
      return res.status(400).send("Invalid characters in address fields");
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
    const search=req.query.search || ''
    const page=parseInt(req.query.page) || 1
    const limit = 1

  
   const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ createdAt: -1 })  
      .lean();

    const query={user:userId,OrderID:{$regex:search,$options:'i'}}

const totalOrders=await Order.countDocuments(query)
const totalPages=Math.ceil(totalOrders/limit)

      res.render('my-orders', {
      user,
      orders,
      currentPage:page,
      totalPages
     
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
    const shipping = 50;
    const total = subtotal + shipping ;

    const method = paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod;

    const generateOrderID = () => {
  return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
};

    const orders = new Order({
      user: user._id,
      shippingAddress: selectedAddress,
      paymentMethod: method,
      items,
      subtotal,
      shipping,
      orderID:generateOrderID(),
      totalAmount: total,
      orderStatus: 'Processing',
    });

    await orders.save();

    for(const item of items){
      await Product.updateOne(
        {_id:item.product},
        {$inc:{quantity:-item.quantity}}
      )
    }

    await Cart.findOneAndUpdate({ user: user._id }, { items: [] });

    res.status(200).json({ success: true, orderId: orders._id });

  } catch (error) {
    console.error('Error placing order:', error.stack);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};






const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const createRazorpayOrder= async(req, res) => {
    const amount = 50000; // Example: ₹500.00 in paise

    const options = {
        amount: amount,
        currency: "INR",
        receipt: "receipt_order_" + Date.now()
    };

    try {
        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            razorpayOrderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error('Razorpay order creation error:', err);
        res.status(500).json({ success: false, message: 'Razorpay order creation failed' });
    }
};












module.exports = {
  getCheckout,
  createRazorpayOrder,
  addAddress,
  editAddress,
  orderConfirm,
  placeOrder
 };
