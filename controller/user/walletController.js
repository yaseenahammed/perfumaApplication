const Wallet=require('../../models/walletSchema')
const User=require('../../models/userSchema')
const Transactions=require('../../models/transactionSchema')
const Razorpay = require('razorpay');
const crypto = require('crypto');


const getWallet = async (req, res) => {
  try {
    

    const user = req.user
    
    
    if (!user) {
      return res.status(401).send( { message: 'Please log in to view your wishlist' });
    }

    const wallet = await Wallet.findOne({ user: user._id });
    const transactions = await Transactions.find({ user: user._id }).sort({ createdAt: -1 });


const previewTransactions = transactions.slice(0, 3); 
const allTransactions = transactions; 





const totalWithdrawnResult = await Transactions.aggregate([
  { $match: { user: user._id, type: 'debit', status: 'Success' } },
  { $group: { _id: null, total: { $sum: '$amount' } } }
]);


const totalWithdrawn = totalWithdrawnResult.length > 0 ? totalWithdrawnResult[0].total : 0;



res.render('wallet', {
  wallet: wallet || { balance: 0 },
  user,
  totalWithdrawn,
  transactions: previewTransactions,
  allTransactions
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

    const amount = parseInt(req.body.amount) / 100 || 500;

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
        const user = req.user; // Or req.session.user depending on your setup

        // 1️⃣ Ensure user is logged in
        if (!user) {
            return res.status(401).json({ success: false, message: 'Please log in to view transactions.' });
        }

        // 2️⃣ Check both dates provided
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please select both start and end dates.'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // 3️⃣ Validate no future dates
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (start > today || end > today) {
            return res.status(400).json({
                success: false,
                message: 'Dates cannot be in the future.'
            });
        }

        // 4️⃣ Validate date order
        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be after end date.'
            });
        }

        // 5️⃣ Get wallet and filtered transactions
        const wallet = await Wallet.findOne({ user: user._id });
        const transactions = await Transactions.find({
            user: user._id,
            createdAt: { $gte: start, $lte: end }
        }).sort({ createdAt: -1 }).lean();

        // 6️⃣ Total withdrawn (keep same logic as getWallet)
        const totalWithdrawnResult = await Transactions.aggregate([
            { $match: { user: user._id, type: 'debit', status: 'Success' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalWithdrawn = totalWithdrawnResult.length > 0 ? totalWithdrawnResult[0].total : 0;

        // 7️⃣ Render view with same structure as getWallet
        res.render('wallet', {
            wallet: wallet || { balance: 0 },
            user,
            totalWithdrawn,
            transactions,        // Only filtered list
            allTransactions: transactions, // So modal still works
            startDate,
            endDate
        });

    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports={
    getWallet,
    createWalletOrder,
    verifyWalletOrder,
    filterTransaction
}

