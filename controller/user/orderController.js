
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const Wallet=require('../../models/walletSchema')
const Transactions=require('../../models/transactionSchema');
const PDFDocument = require('pdfkit');
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

        const refundAmount=order.finalAmount

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


    for (const item of order.items) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }  
            );
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



const cancelItem=async(req,res)=>{
  try {
    const userId=req.session.userId;
    console.log('Cancel request received:', req.params, req.body);

    const {orderID,itemID}=req.params;
    const {reason}=req.body

    if(!userId) return res.status(401).json({message:'unauthorized'})

      
    const order = await Order.findOne({ _id:orderID, user: userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.items.find(i => i.product.toString() === itemID);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.cancelled) return res.status(400).json({ message: 'Item already cancelled' });

    const refundAmount=item.price * item.quantity 
     await Wallet.findOneAndUpdate(
      { user: userId },
      {
        $inc: { balance: refundAmount },
        $push: {
          transactions: {
            type: 'credit',
            amount: refundAmount,
            description: `Refund for cancelled item in order ${orderID}`
          }
        }
      },
      { upsert: true }
    );

    
        await Transactions.create({
  user: userId,
  type: 'Cancellation',
  orderId: order._id,
  amount: refundAmount,
  status: 'Success',
  description: `Refund for cancelled order ${order.orderID}`
});



  

    await Product.updateOne(
      { _id: item.product },
      { $inc: { quantity: item.quantity } }
    );

    item.cancelled = true;
    item.cancelReason = reason || 'No reason provided';
    item.orderStatus='Cancelled'






    await order.save();

if (order.items.every(i => i.orderStatus === 'Cancelled')) {
    order.orderStatus = 'Cancelled';
} else if (order.items.some(i => i.orderStatus === 'ReturnRequest')) {
    order.orderStatus = 'ReturnRequest';
} else if (order.items.every(i => i.orderStatus === 'Delivered')) {
    order.orderStatus = 'Delivered';
} else {
    order.orderStatus = 'Processing'; 
}
    res.json({ success: true, message: 'Item cancelled successfully' });

  } catch (error) {
     console.error('Cancel item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}





const returnItem = async (req, res) => {
  try {
     console.log('return request received:', req.params, req.body);
    const userId = req.session.userId;
    const { orderID, itemID } = req.params;
    const { reason } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const order = await Order.findOne({ _id:orderID, user: userId });
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.items.find(i => i.product.toString() === itemID);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.returnRequested || item.returned) {
      return res.status(400).json({ message: 'Return already requested or processed for this item' });
    }
    

    item.returnRequested = true;
    item.returnReason = reason;
    item.orderStatus='ReturnRequest'

    await order.save();

    res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (error) {
    console.error('Return item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



const downloadInvoice = async (req, res) => {
    try {
        const { orderID } = req.params;
        const userId = req.session.userId;

        // Fetch the order
        const order = await Order.findOne({ orderID, user: userId })
            .populate('items.product')
            .lean();

        if (!order) {
            return res.status(404).send('Order not found');
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${orderID}.pdf`);

        const doc = new PDFDocument({ margin: 50 });
        doc.pipe(res);

        // ---- HEADER ----
        doc.fontSize(20).text('Perfuma Invoice', { align: 'center', underline: true });
        doc.moveDown();

        // Invoice info
        doc.fontSize(12).text(`Invoice Number: ${orderID}`);
        doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
        doc.moveDown();

        // Customer info
        doc.text(`Customer: ${order.shippingAddress.name}`);
        doc.text(`Address: ${order.shippingAddress.address}, ${order.shippingAddress.city}, ${order.shippingAddress.state}`);
        doc.text(`Phone: ${order.shippingAddress.phone}`);
        doc.moveDown(2);

        // ---- TABLE HEADER ----
        const tableTop = doc.y;
        const itemCodeX = 50;
        const descriptionX = 100;
        const qtyX = 300;
        const priceX = 350;
        const totalX = 420;

        doc.fontSize(10).text('S.No', itemCodeX, tableTop, { bold: true });
        doc.text('Item', descriptionX, tableTop);
        doc.text('Qty', qtyX, tableTop);
        doc.text('Price', priceX, tableTop);
        doc.text('Total', totalX, tableTop);

        // Draw a line under the header
        doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

        // ---- TABLE ROWS ----
        let totalAmount = 0;
        let i = 0;
        order.items.forEach(item => {
            const y = tableTop + 25 + (i * 20);
            doc.text(i + 1, itemCodeX, y);
            doc.text(item.product.name, descriptionX, y);
            doc.text(item.quantity, qtyX, y);
            doc.text(`₹${item.price}`, priceX, y);
            doc.text(`₹${item.price * item.quantity}`, totalX, y);
            totalAmount += item.price * item.quantity;
            i++;
        });

        // ---- TOTAL SECTION ----
        doc.moveDown(2);
        doc.fontSize(12).text(`Total Amount: ₹${totalAmount}`, { align: 'right' });
        doc.text(`Payment Method: ${order.paymentMethod}`, { align: 'right' });

        // Footer
        doc.moveDown(4);
        doc.fontSize(10).text('Thank you for shopping with Perfuma!', { align: 'center', italic: true });

        doc.end();
    } catch (error) {
        console.error('Invoice download error:', error);
        res.status(500).send('Server error');
    }
}


module.exports={
  
    getOrders,
    userOrderDetails,
    cancelOrder,
    cancelItem,
    returnOrder,
    returnItem,
    downloadInvoice
 
}