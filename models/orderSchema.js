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
    orderStatus: {
    type: String,
    enum: ['Processing', 'Shipped','Pending', 'Delivered', 'Cancelled','ReturnRequest','Returned','Return Rejected'],
    default: 'Processing'
  },
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelReason: {
      type: String,
      default: ''
    },
    returned: {
      type: Boolean,
      default: false
    },
    returnReason:{
  type:String,
  default:null
},
   
    returnRejectReason: {
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
  enum: ['card', 'upi', 'netbanking', 'cod','wallet'],
  required: true,
},
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Pending'
  },
  isPaid: { 
    type: Boolean, 
    default: false
   },

  orderStatus: {
    type: String,
    enum: ['Processing', 'Shipped','Pending','Delivered', 'Cancelled','ReturnRequest','Returned','Return Rejected'],
    default: 'Processing'
  },
  cancellationReason: {
  type: String,
  default: null
},
 rejectReturnReason: {
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
