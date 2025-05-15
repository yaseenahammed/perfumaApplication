
const mongoose=require("mongoose")
const {Schem}=mongoose






const addresShema=new Schema({
   userId:{
    type:String.Types,ObjectId,
    ref:'User',
    required:true

   },
    
    address:[{
      addressType:{
        type:String,
        required:true
      },
      fullName:{
        type:String,
        required:true
     },
     mobile:{
        type:String,
        required:true
     },
     street:{
      type:String,
      required:true
  },
  city:{
    type:String,
    required:true
  },
  state: {
    type:String,
    required:true
  },
  pincode:{
    type:Number,
    required:true
  }
    }]
    
});

    
const Address=mongoose.model('Address',addresShema)
module.exports=Address
      