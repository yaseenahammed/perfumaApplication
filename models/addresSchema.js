
const mongoose=require("mongoose")
const {Schema}=mongoose






const addresShema=new Schema({
   userId:{
    type: mongoose.Schema.Types.ObjectId,
    ref:'User',
    required:true

   },
    
    addresses: [
  {
   
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true }
  }
]

});

    
const Address=mongoose.model('Address',addresShema)
module.exports=Address
      