const mongoose = require('mongoose');
const { Schema } = mongoose;

const transactionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['Top-up', 'Order', 'Cancellation', 'Return'],
    required: true
  },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Success', 'Pending', 'Failed'], default: 'Success' },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transactions', transactionSchema);
