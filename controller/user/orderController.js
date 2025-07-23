
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
    const shipping = 150;
    const tax = 99;
    const discount = 0;
    const total = subtotal + shipping + tax - discount;

    const method = paymentMethod === 'cod' ? 'Cash on Delivery' : paymentMethod;

    const generateOrderID = () => {
  return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
};

    const orders = new Order({
      user: user._id,
      address: selectedAddress,
      paymentMethod: method,
      items,
      subtotal,
      shipping,
      tax,
      discount,
      orderID:generateOrderID(),
      totalAmount: total,
      orderStatus: 'Processing',
    });

    await orders.save();
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

    const user = await User.findById(userId).lean();

    const orders = await Order.find({
      user: userId,
      orderID: { $regex: search, $options: 'i' }
    })
      .populate('items.product')
      .sort({ createdAt: -1 })
      .lean();

    res.render('my-orders', { user, orders });
  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).send('Internal Server Error');
  }
};



const cancelOrder =async(req,res)=>{
    try {
        const userId=req.session.userId;
        const {orderID}=req.params;
        const {reason}=req.body;

        const order=await Order.findOne({orderID,user:userId})
        
        if(!order){
            return res.status(404).send('order not found')
        }

        if(order.orderStatus!=='Processing' && order.orderStatus!=='Shipped'){
            return res.status(400).send('order cannot be cancelled')
        }

        order.orderStatus='Cancelled';
        order.cancellationReason=reason || 'No reason provided';
        await order.save

        res.redirect('/my-orders')
    } catch (error) {
        console.error('error in cancelOrder',error);
        res.status(500).send('Server Error in cancelOrder');
    }
}




module.exports={
    orderConfirm,
    placeOrder,
    getOrders,
    cancelOrder
}