const mongoose=require('mongoose')
const {Schema}=mongoose;


    const couponSchema = new Schema({

       
        couponCode: {
            type: String,
            required: true,
            unique: true
        },
       
        discountPrice: {
            type: Number,
            required: true
        },
     
        minPrice: {
            type: Number,
            required: true
        },
       expireOn: {
            type: String,
            required: true,
         
        },
        isList:{
            type:Boolean,
            default:true
        },
         maxUsesPerUser: {
      type: Number,
      default: 1, 
    },
  

   
    usedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        count: { type: Number, default: 1 },
      },
    ],

        userId: [{
            type:Schema.Types.ObjectId,
            ref:"User"
        }]
    }, { timestamps: true} );

    const Coupon=mongoose.model('coupen',couponSchema)
    module.exports=Coupon;
