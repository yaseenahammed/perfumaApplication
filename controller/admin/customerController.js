const User=require('../../models/userSchema')



const customerInfo=async(req,res)=>{
  try {
    let search=""
    if(req.query.search){
      search=req.query.search
    }

    let page=1
    if(req.query.page){
      page=parseInt(req.query.page)

    }

    const limit=3

    const filter={
      isAdmin:false,
      $or:[
        {name:{$regex:".*" + search + ".*", $options: "i"}},
        {email:{$regex:".*" + search + ".*", $options: "i"}}
      ]
   }


   const count=await User.countDocuments(filter)



   const userData=await User.find(filter)
    .sort({createdAt:-1})
    .limit(limit)
    .skip((page-1)*limit)
    .exec()
   
 
  

    res.render('customers',{
      data:userData,
      totalPages:Math.ceil(count/limit),
      currentPage:page,
     
    
    })
   

  } catch (error) {
    console.error('Error in customer info page ',error)
    res.redirect('/admin/pageError')
    
  }

}











const blockCustomer=async(req,res)=>{
  try {
    const user=req.query.id
    await User.findByIdAndUpdate(user,{$set:{isBlocked:true}})
    res.redirect('/admin/users')
  } catch (error) {

    console.error('error in block customer',error)
    res.status(500).send('internal server error')
    
  }
}



const unblockCustomer = async (req, res) => {
  try {
    const userId = req.query.id;
    await User.findByIdAndUpdate(userId,{$set:{ isBlocked: false }} );
    res.redirect('/admin/users');
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).send("Internal Server Error");
  }
};





module.exports={
    customerInfo,
    blockCustomer,
    unblockCustomer
}