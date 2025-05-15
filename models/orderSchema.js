const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true
      }
    }
  ],
  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Online'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Pending'
  },
  orderStatus: {
    type: String,
    enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled','ReturnRequest','Returned'],
    default: 'Processing'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  invoiceDate: {
    type: Date,
    default: Date.now
  }
}, 
{
  timestamps: true
});


const Order=mongoose.model('Order', orderSchema);
module.exports = Order;
