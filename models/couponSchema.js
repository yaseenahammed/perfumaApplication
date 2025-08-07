const mongoose=require('mongoose')
const {Schema}=mongoose;


    const couponSchema = new Schema({

       
        couponCode: {
            type: String,
            required: true,
            unique: true
        },
        status: {
            type: Boolean,
            default: true
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
            default:""
        },
        isList:{
            type:Boolean,
            default:true
        },
        userId: [{
            type:Schema.Types.ObjectId,
            ref:"User"
        }]
    }, { timestamps: true} );

    const Coupon=mongoose.model('coupen',couponSchema)
    module.exports=Coupon;
