const Coupon=require('../../models/couponSchema')



const getCoupon=async(req,res)=>{
    try {
    
    const {search='',isList=''}=req.query;
        
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

     let query={}

        if(search){
            query.couponCode={$regex:search,$options:'i'}
        }

         if(isList!==undefined&&isList!==''){
            query.isList = isList==='true'
        }

    
        const totalCoupons=await Coupon.countDocuments(query)
        const coupons=await Coupon.find(query)  
        .sort({createdAt:-1})
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();


    
        res.render('coupon-management',{
            coupons:coupons || [],
            search:search || '',
            isList:isList || '',
            totalPages: Math.ceil(totalCoupons / limit),
            currentPage: page,

        })
    } catch (error) {
         console.error('error in fetching coupons',error)
    }
}



const addCoupon=async(req,res)=>{
    try {
       
        const {couponCode,discountPrice,minPrice,expireOn,isList}=req.body

        if (typeof couponCode !== 'string' || couponCode.trim() === '' ||
             isNaN(discountPrice) ||  isNaN(minPrice) || !expireOn || typeof isList === 'undefined') {
             return res.json({ success: false, message: 'All fields are required and must be valid' });
          }

          if (discountPrice >= minPrice) {
    return res.status(400).json({
        success: false,
        message: 'Discount price must be less than the minimum order price.'
    });
}



        const existingCoupon=await Coupon.findOne({couponCode})
        if(existingCoupon){
            return res.json({success:false,message:'coupon already exist'})
        }

        if (new Date(expireOn) < new Date()) {
        return res.json({ success: false, message: 'Expire date must be in the future.' });
        }


        const couponData={
            couponCode,
            discountPrice:parseFloat(discountPrice),
            minPrice:parseFloat(minPrice),
            expireOn,
            isList: Boolean(req.body.isList),
            maxUsesPerUser: 3

            
        }

        const coupon=await Coupon.create(couponData)
        res.json({success:true,coupon})
    } catch (error) {
        console.error('error in creating coupon',error)
        
    }
}


const updateCoupon=async(req,res)=>{
    try {
      
         const { couponCode } = req.params;
        const { discountPrice, minPrice, expireOn, isList} = req.body;

      
        if (!discountPrice || !minPrice || !expireOn) {
            return res.json({ success: false, message: 'All required fields must be provided.' });
        }
      

        
        const updateData = {
            discountPrice: parseFloat(discountPrice),
            minPrice: parseFloat(minPrice),
            expireOn,
            isList: Boolean(req.body.isList),

            };

        const coupon=await Coupon.findOneAndUpdate({couponCode},
            updateData,
            {new:true,runValidators:true})
            
        if (!coupon) {
            return res.json({ success: false, message: 'Coupon not found.' });
        }
        
      
        res.json({ success: true, coupon });
    } catch (error) {
        console.error('Error updating coupon:', error);
        
    }
}


const deleteCoupon = async (req, res) => {
  try {
    const { couponCode } = req.params;
    const deleted = await Coupon.findOneAndDelete({ couponCode });

    if (!deleted) {
      return res.json({ success: false, message: 'Coupon not found' });
    }

    return res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Error in deleting coupon:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};




module.exports={
    getCoupon,
    addCoupon,
    updateCoupon,
    deleteCoupon
}