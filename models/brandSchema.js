const mongoose = require('mongoose');
const {Schema}=mongoose;

const brandSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  
  },

  brandImage: {
    type: String,
    required:true
  },
  isBlocked:{
    type:Boolean,
    default:false

  }

}, 
{
  timestamps: true
});


const Brand=mongoose.model('Brand', brandSchema);
module.exports = Brand;
