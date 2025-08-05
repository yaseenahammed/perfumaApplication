const Coupon=require('../../models/couponSchema')



const getCoupon=async(req,res)=>{
    try {
    
        const {search,status,isList}=req.query;

        let query={}

        if(search){
            query.couponCode={$regex:search,$options:'i'}
        }

        if(status!==undefined&&status!==''){
            query.status=status==='true'
        }
 
        if(isList!==undefined&&isList!==''){
            query.isList=isList==='true'
        }

        const coupons=await Coupon.find(query).lean()



        res.render('coupon-management',{
            coupons:coupons || [],
            search:search || '',
            status:status || '',
            isList:isList || ''

        })
    } catch (error) {
         console.error('error in fetching coupons',error)
    }
}



const addCoupon=async(req,res)=>{
    try {
        const {couponCode,status,discountPrice,minPrice,expireOn,isList}=req.body

        if(!couponCode || !status || !discountPrice || !minPrice || !expireOn || !isList ){
            return res.json({success:false,message:'All fields are required'})
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
            status: Boolean(req.body.status),
            isList: Boolean(req.body.isList),

            
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
        const { discountPrice, minPrice, expireOn, status, isList} = req.body;

      
        if (!discountPrice || !minPrice || !expireOn) {
            return res.json({ success: false, message: 'All required fields must be provided.' });
        }
         console.log('Updating coupon:', {
      couponCode,
      discountPrice,
      minPrice,
      expireOn,
      status,
      isList,
    
    });

        
        const updateData = {
            discountPrice: parseFloat(discountPrice),
            minPrice: parseFloat(minPrice),
            expireOn,
            status: Boolean(req.body.status),
            isList: Boolean(req.body.isList),

            
        };

        const coupon=await Coupon.findOneAndUpdate({couponCode},updateData,{new:true,runValidators:true})
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