
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Wallet=require('../../models/walletSchema')
const Transactions=require('../../models/transactionSchema');
const { getBestPrice } = require('../../helpers/offerHelper');




const getOrders = async (req, res) => {
  try {
    const userId = req.session.userId;
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const user = await User.findById(userId).lean();

    const query = {
      user: userId,
      orderID: { $regex: search, $options: 'i' }
    };

    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find(query)
      .populate('items.product')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.render('my-orders', {
      user,
      orders,
      currentPage:page,
      totalPages
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
    const itemPrice = item.product.finalPrice ||item.product.salePrice ||item.product.regularPrice;
    const quantity = item.quantity;
    const itemTotalBeforeTax = itemPrice * quantity;
    subtotal += itemTotalBeforeTax;
  });
  const total = subtotal + SHIPPING_FEE;
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    shipping: SHIPPING_FEE,
    total: parseFloat(total.toFixed(2)) 
  };
};


const userOrderDetails = async (req, res) => {
  try {
   
    const userId = req.session.userId;
    const orderID = req.params.orderID;
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
        item.product.isBlocked 
       
      ) {
        hasInvalidItems = true;
      } else {
        const {finalPrice}=await getBestPrice(item.product)
        item.product.finalPrice=finalPrice
        validOrderItems.push(item);
      }
    }


    if (hasInvalidItems) {
      req.flash('error', 'Some items in your cart are unavailable');
      return res.redirect('/my-orders');
    }

    
  
    order.items = validOrderItems;
    const summary = calculateSummary(validOrderItems);

   res.render('orderDetails-user', {
      order,
      user,
      summary,
     
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

        const refundAmount=order.totalAmount

        await Wallet.findOneAndUpdate(
          {user:userId},
          {
            $inc:{balance:refundAmount},
            $push:{
              transactions:{
                type:'credit',
                amount:refundAmount,
                description:`Refund for cancelled order ${order._id}`
              }
            }
          },
          {upsert:true}
        )

        await Transactions.create({
  user: userId,
  type: 'Cancellation',
  orderId: order._id,
  amount: refundAmount,
  status: 'Success',
  description: `Refund for cancelled order ${order.orderID}`
});


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





         if (!order || order.orderStatus !== 'ReturnRequest') {
            const refundAmount=order.totalAmount

  await Wallet.findOneAndUpdate(
          {user:userId},
          {
            $inc:{balance:refundAmount},
            $push:{
              transactions:{
                type:'credit',
                amount:refundAmount,
                description:`Refund for cancelled order ${order._id}`
              }
            }
          },
          {upsert:true}
        )

        await Transactions.create({
  user: userId,
  type: 'Return',
  orderId: order._id,
  amount: refundAmount,
  status: 'Success',
  description: `Refund for returned order ${order.orderID}`
});

        }



   

        res.json({ success: true, message: 'Return request submitted to admin' });
    } catch (error) {
        console.error('Error in returnOrder:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



module.exports={
  
    getOrders,
    userOrderDetails,
    cancelOrder,
    returnOrder,
 
}