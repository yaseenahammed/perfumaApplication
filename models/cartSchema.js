const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
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
        min: 1,
        default: 1
      },
      price:{
        type:Number,
        required:true
      },
      totalPrice:{
        type:Number,
        required:true
      },
      cancellationReason:{
        type:String,
        default:"none"
      }
    }
  ]
}, {
  timestamps: true
});

const Cart=mongoose.model('Cart', cartSchema);
module.exports = Cart;
