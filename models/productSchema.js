const mongoose=require('mongoose')
const {Schema}=mongoose

const productSchema=new Schema({
    name: {
        type: String,
        required: true
      },
      brand: {
        type: String,
        required: true
      },
      description: {
        type: String
      },
      category: {
        type:Schema.Types.ObjectId,
        ref:"category"
      },
      regularPrice: {
        type: Number,
        required: true
      },
      discount: {
        type: Number,
        default: 0
      },
      salePrice: {
        type: Number
      },
      inStock: {
        type: Boolean,
        default: true
      },
      quantity: {
        type: Number,
        required: true
      },
      productImages:{
        type:{String},
        required:true
      },
      status:{
        type:String,
        enum:['Availeble','not availble','discounted'],
        required:true,
        default:"Availeble"
      }

},{timestamps:true})




const Product=mongoose.model('Product',productSchema)
module.exports=Product;