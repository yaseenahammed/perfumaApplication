const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product=require('../../models/productSchema')
const Wallet=require('../../models/walletSchema')
const Transactions=require('../../models/transactionSchema')

const orderListing = async (req, res) => {
    try {
        const { search = '', sort = 'desc', filter = '', page = 1 } = req.query;
        const perPage = 10;
        const query = {};

       
        if (search) {
            if (!/^[a-zA-Z0-9-]*$/.test(search)) {
                return res.status(400).render('order-management', {
                    orders: [],
                    currentPage: 1,
                    totalPages: 1,
                    search,
                    sort,
                    filter,
                    error: 'Invalid search term'
                });
            }
            query.orderID = { $regex: search, $options: 'i' };
        }

        
        if (filter) query.orderStatus = filter;

        

        const orders = await Order.find(query)
            .populate('user items.product')
            .sort({ createdAt: sort === 'desc' ? -1 : 1 })
            .skip((page - 1) * perPage)
            .limit(perPage)
            .lean();

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / perPage);
        const currentPage = parseInt(page);
          
        

        orders.forEach(order=>{
            order.itemCount=order.items ? order.items.length : 0

            order.returnRequestCount=order.items ? 
            order.items.filter(item=>item.orderStatus==='ReturnRequest').length :0
        })


        

        res.render('order-management', {
            orders,
            currentPage,
            totalPages,
            search,
            sort,
            filter,
            
        });
    } catch (error) {
        console.error('Error in fetching orders from orderListing:', error);
        res.status(500).render('order-management', {
            orders: [],
            currentPage: 1,
            totalPages: 1,
            search: '',
            sort: 'desc',
            filter: '',
            error: 'Internal Server Error'
        });
    }
};
const updateStatus = async (req, res) => {
  try {
    const { orderId } = req.params; // this will be like "ORD-984403"
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Out for Delivery",
      "Cancelled",
    ];
    if (!allowedStatuses.includes(status)) {
      return res.json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findOneAndUpdate(
      { orderID: orderId }, // 👈 match custom orderID
      {
        $set: {
          orderStatus: status,
          "items.$[].orderStatus": status, // 👈 update every item
        },
      },
      { new: true }
    );

    if (order) {
      let nextOptions = [];
      if (order.orderStatus === "Processing")
        nextOptions = ["Shipped", "Cancelled"];
      else if (order.orderStatus === "Shipped")
        nextOptions = ["Out for Delivery", "Cancelled"];
      else if (order.orderStatus === "Out for Delivery")
        nextOptions = ["Delivered", "Cancelled"];

      return res.json({
        success: true,
        status: order.orderStatus,
        nextOptions,
      });
    } else {
      return res.json({ success: false, message: "Order not found" });
    }
  } catch (error) {
    console.error("Error in updateStatus:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const verifyReturn = async (req, res) => {
    try {
        const { orderID } = req.params;
        const order = await Order.findOne({ orderID }).populate('user');

        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }

        if (order.orderStatus !== 'ReturnRequest') {
            return res.json({ success: false, message: 'Invalid return request' });
        }

        // Update overall order status
        order.orderStatus = 'Returned';

        const refundAmount = order.finalAmount;
        order.refundAmount += refundAmount;
        order.netAmount = order.finalAmount - order.refundAmount;

       
        for (const item of order.items) {
            if (item.orderStatus === 'ReturnRequest' || item.orderStatus === 'Delivered') {
                item.orderStatus = 'Returned'; 
            }

            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }  
            );
        }

        await order.save();

        // Process wallet refund
        const userId = order.user._id;
        await Wallet.findOneAndUpdate(
            { user: userId },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for returned order ${order.orderID}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true }
        );

        // Add to transactions log
        await Transactions.create({
            user: userId,
            type: 'Return',
            orderId: order._id,
            amount: refundAmount,
            status: 'Success',
            description: `Refund for returned order ${order.orderID}`
        });

        res.json({ success: true, message: 'Return verified and refund processed' });

    } catch (error) {
        console.error('Error in verifyReturn:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};



const verifyReturnItem = async (req, res) => {
    try {
        console.log('Reached item return');
        const { orderID, itemID } = req.params;

        const order = await Order.findOne({ orderID })
            .populate('user')
            .populate('items.product');

        if (!order) return res.json({ success: false, message: 'Order not found' });

        const item = order.items.id(itemID);
        if (!item || item.orderStatus !== 'ReturnRequest') {
            return res.json({ success: false, message: 'Invalid return request for this item' });
        }

   
        item.orderStatus = 'Returned';
         const refundAmount = item.price * item.quantity;

        order.refundAmount += refundAmount;   
        order.netAmount = order.finalAmount - order.refundAmount;

          await Product.updateOne(
              { _id: item.product },
              { $inc: { quantity: item.quantity } }
            );

        await order.save();

       
        const userId = order.user._id;

        await Wallet.findOneAndUpdate(
            { user: userId },
            {
                $inc: { balance: refundAmount },
                $push: {
                    transactions: {
                        type: 'credit',
                        amount: refundAmount,
                        description: `Refund for returned item ${item.product.name}`,
                        date: new Date()
                    }
                }
            },
            { upsert: true }
        );

        await Transactions.create({
            user: userId,
            type: 'Return',
            orderId: order._id,
            amount: refundAmount,
            status: 'Success',
            description: `Refund for returned item ${item.product.name}`
        });

        res.json({ success: true, message: 'Item return verified and refund processed' });

    } catch (error) {
        console.error('Error in verifyReturnItem:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};




const rejectReturn = async (req, res) => {
    try {
   
        const { orderID } = req.params;
        const {reason}=req.body;
        const order = await Order.findOne({ orderID });

        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }

        if (order.orderStatus !== 'ReturnRequest') {
            return res.json({ success: false, message: 'Invalid return request' });
        }

        
        order.orderStatus = 'Return Rejected'; 
        order.returnRejected = true;
        order.rejectReturnReason=reason || 'No reason Provided'
        await order.save();

        res.json({ success: true, message: 'Return request rejected.' });
    } catch (error) {
        console.error('Error in rejectReturn:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const rejectReturnItem = async (req, res) => {
    try {
        console.log('reached item reject');
        const { orderID, itemID } = req.params;
        const { reason } = req.body;

        const order = await Order.findOne({ orderID });
        if (!order) return res.json({ success: false, message: 'Order not found' });

        const item = order.items.id(itemID);
        if (!item || item.orderStatus !== 'ReturnRequest') {
            return res.json({ success: false, message: 'Invalid return request for this item' });
        }


        item.orderStatus = 'Return Rejected';
        item.returned = false; 
        item.returnRejectReason = reason || 'No reason provided';

        await order.save();

        res.json({ success: true, message: 'Item return request rejected.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const orderDetails = async (req, res) => {
    try {
        const { orderID } = req.params;
        const order = await Order.findOne({ orderID }).populate('user items.product');

      

        if (order) {
            res.render('order-details', { order });
        } else {
            res.status(404).send('Order not found');
        }
    } catch (error) {
        console.error('Error in orderDetails', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    orderListing,
    updateStatus,
    verifyReturn,
    verifyReturnItem,
    orderDetails,
    rejectReturn,
    rejectReturnItem
};