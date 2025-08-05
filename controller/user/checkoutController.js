const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addresSchema');
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema');
const Transactions=require('../../models/transactionSchema')
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

    const total = subtotal + SHIPPING_FEE;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        shipping: SHIPPING_FEE,
        total
    };
};

const getCheckout = async (req, res) => {
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

        let eligibleCoupons = [];
        try {
            eligibleCoupons = await Coupon.find({
                $or: [
                    { userId: { $in: [user._id] } },
                    { userId: { $size: 0 } }
                ],
                status: true,
                isList: true,
                minPrice: { $lte: summary.subtotal },
                expireOn: { $gte: new Date().toISOString().split('T')[0] }
            }).lean();
        } catch (couponError) {
            console.error('Error in coupons:', couponError);
            eligibleCoupons = [];
        }

        const addresses = addressDoc?.addresses || [];
        let selectedAddress = null;
        const selectedAddressId = req.session.selectedAddressId;

        if (selectedAddressId) {
            selectedAddress = addresses.find(addr => addr._id.toString() === selectedAddressId) || null;
        }
        if (!selectedAddress && addresses.length > 0) {
            selectedAddress = addresses.find(addr => addr.isDefault) || addresses[0];
            req.session.selectedAddressId = selectedAddress._id.toString(); // Persist default selection
        }

        

        res.render('checkout', {
            title: 'Checkout',
            user: user,
            cartItems: validCartItems,
            userAddresses: addresses,
            selectedAddress: selectedAddress,
            selectedAddressId: selectedAddress?._id?.toString() || null,
            hasAddresses: addresses.length > 0,
            subtotal: summary.subtotal,
            shipping: summary.shipping,
            total: summary.total,
            eligibleCoupons,
            appliedCouponCode: req.session.appliedCouponCode || null,
            appliedDiscountPrice: req.session.discountPrice || 0
        });
    } catch (error) {
        console.error('Error in checkout:', error);
        req.flash('error', 'Could not load checkout page. Please try again.');
        res.redirect('/pageNotFound');
    }
};

const selectAddress = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.userId;

        const addressDoc = await Address.findOne({ userId, "addresses._id": addressId });
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        req.session.selectedAddressId = addressId;
        res.json({ success: true, message: 'Address selected' });
    } catch (error) {
        console.error('Error selecting address:', error);
        res.status(500).json({ success: false, message: 'Failed to select address' });
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { phone, street, city, state, zip, country } = req.body;

        const isDigitsOnly = /^\d+$/;
        const isValidText = (text) => typeof text === 'string' && text.trim() !== '' && !/[^\w\s\-.,]/.test(text);

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
        req.session.selectedAddressId = userAddress.addresses[userAddress.addresses.length - 1]._id.toString();
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
        const isValidText = (text) => typeof text === 'string' && text.trim() !== '' && !/[^\w\s\-.,]/.test(text);

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
        req.session.selectedAddressId = addressId;
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
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 1;

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 })
            .lean();

        const query = { user: userId, orderID: { $regex: search, $options: 'i' } };
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('my-orders', {
            user,
            orders,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error('error in order details page', error);
        res.redirect('/pageNotFound');
    }
};

const placeOrder = async (req, res) => {
    try {
        const { addressId, paymentMethod, couponCode, discountPrice } = req.body;
        const userId = req.session.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        const selectedAddressDoc = await Address.findOne(
            { userId, "addresses._id": addressId },
            { "addresses.$": 1 }
        );

        if (!selectedAddressDoc || !selectedAddressDoc.addresses.length) {
            return res.status(400).json({ success: false, message: 'Selected address not found' });
        }

        const shippingAddress = selectedAddressDoc.addresses[0];

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
        const shipping = SHIPPING_FEE;

        let finalDiscountPrice = 0;
        let appliedCouponCode = null;

        if (couponCode) {
            if (couponCode !== req.session.appliedCouponCode) {
                return res.status(400).json({ success: false, message: 'Coupon code does not match the applied coupon' });
            }

            const coupon = await Coupon.findOne({ couponCode }).lean();
            if (!coupon) {
                return res.status(400).json({ success: false, message: 'Coupon not found' });
            }
            if (!coupon.status) {
                return res.status(400).json({ success: false, message: 'Coupon is inactive' });
            }
            if (!coupon.isList) {
                return res.status(400).json({ success: false, message: 'Coupon is not listed' });
            }
            if (new Date(coupon.expireOn) < new Date()) {
                return res.status(400).json({ success: false, message: 'Coupon has expired' });
            }
            if (coupon.minPrice > subtotal) {
                return res.status(400).json({ success: false, message: `Minimum order value of ₹${coupon.minPrice} required` });
            }
            if (coupon.userId.length > 0 && !coupon.userId.some(id => id.toString() === userId.toString())) {
                return res.status(400).json({ success: false, message: 'Coupon not applicable to this user' });
            }
            if (parseFloat(discountPrice) !== coupon.discountPrice) {
                return res.status(400).json({ success: false, message: 'Invalid discount price' });
            }

            finalDiscountPrice = coupon.discountPrice;
            appliedCouponCode = couponCode;
        } else if (req.session.appliedCouponCode) {
            return res.status(400).json({ success: false, message: 'No coupon code provided but a coupon is applied in session' });
        }

        const total = subtotal + shipping - finalDiscountPrice;

        const allowedMethods = ['cod', 'card', 'upi', 'netbanking'];
        if (!allowedMethods.includes(paymentMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        const method = paymentMethod === 'cod' ? 'cod' : paymentMethod;

        const generateOrderID = () => {
            return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
        };

        const orders = new Order({
            user: user._id,
            shippingAddress,
            paymentMethod: method,
            items,
            subtotal,
            shipping,
            couponCode: appliedCouponCode,
            discountPrice: finalDiscountPrice,
            orderID: generateOrderID(),
            totalAmount: total,
            orderStatus: 'Processing',
        });

        await orders.save();

//         await Transactions.create({
//   user: user._id,
//   type: 'Order',
//   orderId: orders._id,
//   amount: total,
//   status: 'Success',
//   description: `Placed order ${orders.orderID}`
// });


        for (const item of items) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: -item.quantity } }
            );
        }

        await Cart.findOneAndUpdate({ user: user._id }, { items: [] });

        
        req.session.appliedCouponCode = null;
        req.session.discountPrice = null;
        req.session.selectedAddressId = null;

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

const createRazorpayOrder = async (req, res) => {
    try {
        const { paymentMethod, couponCode, discountPrice } = req.body;
        const userId = req.session.userId;

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
        const shipping = SHIPPING_FEE;

        let finalDiscountPrice = 0;
        let appliedCouponCode = null;

        if (couponCode) {
            if (couponCode !== req.session.appliedCouponCode) {
                return res.status(400).json({ success: false, message: 'Coupon code does not match the applied coupon' });
            }

            const coupon = await Coupon.findOne({ couponCode }).lean();
            if (!coupon) {
                return res.status(400).json({ success: false, message: 'Coupon not found' });
            }
            if (!coupon.status) {
                return res.status(400).json({ success: false, message: 'Coupon is inactive' });
            }
            if (!coupon.isList) {
                return res.status(400).json({ success: false, message: 'Coupon is not listed' });
            }
            if (new Date(coupon.expireOn) < new Date()) {
                return res.status(400).json({ success: false, message: 'Coupon has expired' });
            }
            if (coupon.minPrice > subtotal) {
                return res.status(400).json({ success: false, message: `Minimum order value of ₹${coupon.minPrice} required` });
            }
            if (coupon.userId.length > 0 && !coupon.userId.some(id => id.toString() === userId.toString())) {
                return res.status(400).json({ success: false, message: 'Coupon not applicable to this user' });
            }
            if (parseFloat(discountPrice) !== coupon.discountPrice) {
                return res.status(400).json({ success: false, message: 'Invalid discount price' });
            }

            finalDiscountPrice = coupon.discountPrice;
            appliedCouponCode = couponCode;
        } else if (req.session.appliedCouponCode) {
            return res.status(400).json({ success: false, message: 'No coupon code provided but a coupon is applied in session' });
        }

        const total = subtotal + shipping - finalDiscountPrice;
        const amount = Math.round(total * 100); // Convert to paise

        const options = {
            amount,
            currency: "INR",
            receipt: "receipt_order_" + Date.now()
        };

        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            razorpayOrderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Razorpay order creation error:', error);
        res.status(500).json({ success: false, message: 'Razorpay order creation failed' });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, subtotal } = req.body;
        const userId = req.session.userId;

        const subtotalNum = parseFloat(subtotal);
        if (!couponCode || isNaN(subtotalNum) || subtotalNum <= 0) {
            return res.status(400).json({ success: false, message: 'Coupon code and valid subtotal are required.' });
        }

        const coupon = await Coupon.findOne({ couponCode }).lean();
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found.' });
        }
        if (!coupon.status) {
            return res.status(400).json({ success: false, message: 'Coupon is inactive.' });
        }
        if (!coupon.isList) {
            return res.status(400).json({ success: false, message: 'Coupon is not listed.' });
        }
        if (new Date(coupon.expireOn) < new Date()) {
            return res.status(400).json({ success: false, message: 'Coupon has expired.' });
        }
        if (coupon.minPrice > subtotalNum) {
            return res.status(400).json({ success: false, message: `Minimum order value of ₹${coupon.minPrice} required.` });
        }
        if (coupon.userId.length > 0 && !coupon.userId.some(id => id.toString() === userId.toString())) {
            return res.status(400).json({ success: false, message: 'Coupon not applicable to this user.' });
        }

        req.session.appliedCouponCode = couponCode;
        req.session.discountPrice = coupon.discountPrice;

        res.json({ success: true, discountPrice: coupon.discountPrice });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Failed to apply coupon.' });
    }
};

module.exports = {
    getCheckout,
    createRazorpayOrder,
    addAddress,
    editAddress,
    orderConfirm,
    placeOrder,
    applyCoupon,
    selectAddress
};