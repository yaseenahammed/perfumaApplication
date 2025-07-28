const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');

const orderListing = async (req, res) => {
    try {
        const { search = '', sort = 'desc', filter = '', page = 1 } = req.query;
        const perPage = 10;
        const query = {};

        // Apply search only if searchTerm is provided and valid
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

        // Apply filter if provided
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

        // Restrict status to 'Returned' to match frontend logic
        if (!status || status === 'Returned') {
            return res.json({ success: false, message: 'Invalid status. Only "Returned" is allowed.' });
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

      
        const user = await User.findById(order.user._id);
        if (user) {
            user.wallet = (user.wallet || 0) + order.totalAmount;
            await user.save();
        }

        res.json({ success: true, message: 'Return verified and amount refunded to wallet.' });
    } catch (error) {
        console.error('Error in verifyReturn:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const rejectReturn = async (req, res) => {
    try {
    console.log('reject return trigered')
        const { orderID } = req.params;
        const order = await Order.findOne({ orderID });

        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }

        if (order.orderStatus !== 'ReturnRequest') {
            return res.json({ success: false, message: 'Invalid return request' });
        }

        
        order.orderStatus = 'Delivered'; 
        await order.save();

        res.json({ success: true, message: 'Return request rejected.' });
    } catch (error) {
        console.error('Error in rejectReturn:', error);
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
    orderDetails,
    rejectReturn
};