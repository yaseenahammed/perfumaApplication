const mongoose = require('mongoose');
const {Schema}=mongoose

const categorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    
  },
  description: {
    type: String
  },
  isListed:{
    type:Boolean,
    default:true
  },
   offer: {                          
    type: Number,
    default: 0                        
  },
  image: {
    type: String
  }
},
 {
  timestamps: true 
});


const Category=mongoose.model('Category', categorySchema)
module.exports=Category;
