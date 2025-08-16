const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
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

        res.render('order-management', {
            orders,
            currentPage,
            totalPages,
            search,
            sort,
            filter
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
        const { orderId } = req.params;
        const { status } = req.body;

        
        if (!status || status === 'Returned') {
            return res.json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findOneAndUpdate(
            { orderID: orderId },
            { orderStatus: status },
            { new: true }
        );

        if (order) {
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Order not found' });
        }
    } catch (error) {
        console.error('Error in updateStatus:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
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

   
        order.orderStatus = 'Returned';
        await order.save();

        const refundAmount = order.finalAmount;
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

        // Mark item as returned
        item.orderStatus = 'Returned';

        await order.save();

        const refundAmount = item.price * item.quantity;
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