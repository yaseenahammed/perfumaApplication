const mongoose=require('mongoose')
const {Schema}=mongoose;


    const couponSchema = new Schema({

        name: {
            type: String,
            required: true
        },
       description: {
            type: String,
            required: true
        },
        coupenCode: {
            type: String,
            required: true,
            unique: true
        },
        status: {
            type: Boolean,
            default: true
        },
        discountPercentage: {
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
            dafault:true
        },
        userId: [{
            type:Schema.Types.ObjectId,
            ref:"user"
        }]
    }, { timestamps: true} );

    const Coupen=mongoose.model('coupen',coupenSchema)
    module.exports=Coupen;
