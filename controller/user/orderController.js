
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Address = require('../../models/addresSchema');




const orderConfirm = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).lean();

    const orders = await Order.find({ user: userId })
      .populate('items.product')
      .sort({ createdAt: -1 })  
      .lean();

    res.render('my-orders', {
      user,
      orders
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


const getOrders = async (req, res) => {
  try {
    const userId = req.session.userId;
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const query = { user: userId };

    const user = await User.findById(userId).lean();

    const orders = await Order.find({
      user: userId,
      orderID: { $regex: search, $options: 'i' }
    })
      .populate('items.product')
      .sort({ createdAt: -1 })
      .lean();

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('my-orders', {
      user,
      orders,
      currentPage: page,
      totalPages,
      sort: req.query.sort || '', // <-- Add this
      categoryId: req.query.category ? [].concat(req.query.category) : [], // <-- Add this
      brandId: req.query.brand ? [].concat(req.query.brand) : [], // <-- Add this
      priceRange: req.query.price || '', // <-- Add this
      searchQuery: search // <-- Add this
    });

  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).send('Internal Server Error');
  }
};










const SHIPPING_FEE = 50;

const calculateSummary = (cartItems) => {
  let subtotal = 0;
  cartItems.forEach(item => {
    const itemPrice = item.product.salePrice;
    const quantity = item.quantity;
    const itemTotalBeforeTax = itemPrice * quantity;
    subtotal += itemTotalBeforeTax;
  });
  const total = subtotal + SHIPPING_FEE;
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping: SHIPPING_FEE,
    total: parseFloat(total.toFixed(2)) // Ensure total has consistent decimal places
  };
};

const userOrderDetails = async (req, res) => {
  try {
    const userId = req.session.userId;
    const orderID = req.params.orderID;
    const addressDoc = await Address.findOne({ userId }).lean(); 
    const user = await User.findById(userId).lean();
    
    if (typeof orderID !== 'string' || !orderID.trim()) {
      return res.status(400).send('Invalid order ID');
    }

   
    const order = await Order.findOne({ orderID })
      .populate('user items.product shippingAddress') 
      .lean();

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const validOrderItems = [];
    let hasInvalidItems = false;

    for (const item of order.items) {
      if (
        !item.product || 
        !item.product.isListed || 
        item.product.isBlocked || 
        item.quantity > item.product.quantity
      ) {
        hasInvalidItems = true;
      } else {
        validOrderItems.push(item);
      }
    }

    if (hasInvalidItems) {
      req.flash('error', 'Some items in your cart are unavailable or out of stock. Please review your orders.');
      return res.redirect('/userOrder-details');
    }

  
    order.items = validOrderItems;
    const summary = calculateSummary(validOrderItems);

   

    order.items.forEach(item => {
      console.log('Product Image:', item.product.productImages); // Debug log
    });

    res.render('orderDetails-user', {
      order,
      user,
      summary
    });

  } catch (error) {
    console.error('Error in userOrderDetails:', error);
    res.status(500).send('Internal Server Error');
  }
};

const cancelOrder = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { orderID } = req.params;
        const { reason } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const order = await Order.findOne({ orderID, user: userId });

        if (!order || (order.orderStatus !== 'Processing' && order.orderStatus !== 'Shipped')) {
            return res.status(400).json({ message: 'Cannot cancel this order' });
        }

        order.orderStatus = 'Cancelled';
        order.cancellationReason = reason || 'No reason provided';
        await order.save();

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error in cancelOrder:', error);
        res.status(500).json({ message: 'Server error' });
    }
};





const returnOrder = async (req, res) => {
 
    try {
        const userId = req.session.userId;
        const { orderID } = req.params;
        const { reason } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const order = await Order.findOne({ orderID, user: userId });

        if (!order || order.orderStatus !== 'Delivered') {
            return res.status(400).json({ message: 'Cannot return this order' });
        }

        order.orderStatus = 'ReturnRequest';
        order.returnReason = reason;
        await order.save();

        res.json({ success: true, message: 'Return request submitted to admin' });
    } catch (error) {
        console.error('Error in returnOrder:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



module.exports={
    orderConfirm,
    placeOrder,
    getOrders,
    userOrderDetails,
    cancelOrder,
    returnOrder,
 
}