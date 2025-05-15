const User=require('../../models/userSchema')



const customerInfo=async(req,res)=>{
    try {
        let search="";
        if(req.query.search){
            search=req.query.search;
        }
        let page=1;
        if(req.query.page){
            page=req.query.page;
        }
        const limit=3;
        const userData=await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
            ],
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()

        const count=await User.find({
             isAdmin:false,
            $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
            ],
        }).countDocuments();

        console.log("Fetched users:", userData);

        res.render('customers',{
            data:userData,
            totalPages:Math.ceil(count/limit),
            currentPage:page
        })

    } catch (error) {
        res.redirect('/admin/pageError')
        
    }
}





const blockCustomer = async (req, res) => {
  try {
    const userId = req.query.id;
    await User.findByIdAndUpdate(userId, { isBlocked: true });
    res.redirect('/admin/users');
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).send("Internal Server Error");
  }
};


const unblockCustomer = async (req, res) => {
  try {
    const userId = req.query.id;
    await User.findByIdAndUpdate(userId, { isBlocked: false });
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