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
    },
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelReason: {
      type: String,
      default: ''
    }
  }
],

 
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    phone: String
  },
 paymentMethod: {
  type: String,
  enum: ['card', 'upi', 'netbanking', 'cod'],
  required: true,
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
  cancellationReason: {
  type: String,
  default: null
},
returnReason:{
  type:String,
  default:null
},

  orderID: {
  type: String,
  required: true,
  index: true
},


  totalAmount: {
    type: Number,
    required: true
  },
   couponCode: {
        type: String,
        default: null
    },
     discountPrice: {
        type: Number,
        default: 0,
        min: 0
    },
finalAmount: {
  type: Number,
  required: true
}
,
  Date: {
    type: Date,
    default: Date.now
  }
}, 
{
  timestamps: true
});


const Order=mongoose.model('Order', orderSchema);
module.exports = Order;
