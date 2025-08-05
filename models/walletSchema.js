const mongoose = require('mongoose');
const { Schema } = mongoose;

const walletSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [
    {
      transactionId: String,
      type: {
        type: String,
        enum: ['credit', 'debit']
      },
      amount: Number,
      description: String,
      status: {
        type: String,
        enum: ['Success', 'Failed'],
        default: 'Success'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

module.exports = mongoose.model('Wallet', walletSchema);
