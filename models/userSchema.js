const mongoose=require('mongoose')
const {Schema}=mongoose

const userSchema=new Schema({
    name:{
        type:String,
        required:true,
   },
   email:{
    type:String,
    required:true,
    unique:true
   },
   
   googleId:{
    type:String,
    unique:true,
    sparse:true
   },
   password:{
    type:String,
    required:false

   },
   isBlocked:{
    type:Boolean,
    default:false
   },
   isAdmin:{
    type:Boolean,
    default:false
   },
     otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  profileImage: {
  type: String,
  default: 'default.png'
},
 

   cart:[{
    type:Schema.Types.ObjectId,
    ref:'Cart'
   }],
   orderHistory:[{
    type:Schema.Types.ObjectId,
    ref:'Order'
   }],
   referelCode:{
    type:String
   },
   redeemed:{
    type:Boolean
   },
   redeemedUsers:{
    type:Schema.Types.ObjectId,
    ref:'User'
   },
   searchUsers:[{
    category:{
       type:Schema.Types.ObjectId,
       ref:'Category'
    },
    brand:{
        type:String
    },
    searchOn:{
        type:Date,
        default:Date.now
    }
   }],
},
{timestamps:true}
)

const User=mongoose.model("User",userSchema)
module.exports=User