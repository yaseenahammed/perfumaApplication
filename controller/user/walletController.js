const Wallet=require('../../models/walletSchema')
const User=require('../../models/userSchema')
const Transactions=require('../../models/transactionSchema')
const Razorpay = require('razorpay');
const crypto = require('crypto');


const getWallet = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).send({ message: 'Please log in to view your wallet' });
    }

    const wallet = await Wallet.findOne({ user: user._id });
    const previewTransactions = await Transactions.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5); 

    const totalWithdrawnResult = await Transactions.aggregate([
      { $match: { user: user._id, type: 'debit', status: 'Success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalWithdrawn = totalWithdrawnResult.length > 0 ? totalWithdrawnResult[0].total : 0;

    res.render('wallet', {
      wallet: wallet || { balance: 0 },
      user,
      totalWithdrawn,
      transactions: previewTransactions
    });
  } catch (error) {
    console.error('Error in getting wallet:', error);
    res.status(500).render('error', { message: 'Something went wrong while fetching wallet data.' });
  }
};





const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


const createWalletOrder=async(req,res)=>{
    try {
        const {amount}=req.body
        if(!amount ||isNaN(amount) ){
            return res.status(400).json({success:false,message:'invalid amount'})
        }
        const options={
      amount: amount * 100, 
      currency: "INR",
      receipt: `wallet_topup_${Date.now()}`,
      payment_capture: 1
        }

        const order=await razorpay.orders.create(options)
        res.json({success:true,orderId:order.id,amount:order.amount,currency:order.currency,key:process.env.RAZORPAY_KEY_ID})
    } catch (error) {
        console.error('error in adding money to wallet',error)
        return res.status(500).json({ success:false, message:'Could not create order' })
    }
}


const verifyWalletOrder = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.session.userId;



    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

     const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const amount = payment.amount / 100;
    const wallet = await Wallet.findOne({ user: userId });

    if (wallet) {
      wallet.balance += amount;
      wallet.transactions.push({
        transactionId: razorpay_payment_id,
        type: 'credit',
        amount,
        description: 'Added funds via Razorpay',
        status: 'Success'
      });
      await wallet.save();
    } else {
      await Wallet.create({
        user: userId,
        balance: amount,
        transactions: [
          {
            transactionId: razorpay_payment_id,
            type: 'credit',
            amount,
            description: 'Added funds via Razorpay',
            status: 'Success'
          }
        ]
      });
    }

    
    await Transactions.create({
  user: userId,
  transactionId: razorpay_payment_id,
  type: 'credit',
  amount: amount,
  status: 'Success',
  description: `Added ₹${amount} via Razorpay`
});

    

    res.json({ success: true });
  } catch (error) {
    console.error('Wallet payment verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const filterTransaction = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.session.userId; 

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please log in to view transactions.' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please select both start and end dates.'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (start > today || end > today) {
      return res.status(400).json({
        success: false,
        message: 'Dates cannot be in the future.'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date.'
      });
    }

    const wallet = await Wallet.findOne({ user: userId });
    const transactions = await Transactions.find({
      user: userId,
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 }).lean();

    const totalWithdrawnResult = await Transactions.aggregate([
      { $match: { user: userId, type: 'debit', status: 'Success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawn = totalWithdrawnResult.length > 0 ? totalWithdrawnResult[0].total : 0;

    res.render('wallet', {
      wallet: wallet || { balance: 0 },
      user: userId,
      totalWithdrawn,
      transactions,     
      allTransactions: transactions, 
      startDate,
      endDate
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


const getAllTransactions = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).send({ message: 'Please log in' });

    let { page = 1, limit = 10, startDate, endDate, type, status } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const query = { user: userId };

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    if (type && ['credit', 'debit'].includes(type)) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    }

    const total = await Transactions.countDocuments(query);

    const transactions = await Transactions.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.render('transaction', {
      transactions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      filters: { startDate, endDate, type, status },
      user: userId
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).render('error', { message: 'Error fetching transactions.' });
  }
};




module.exports={
    getWallet,
    createWalletOrder,
    verifyWalletOrder,
    filterTransaction,
    getAllTransactions
}

