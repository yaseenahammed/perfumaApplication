const Order=require('../../models/orderSchema')



const getSalesReport=async(req,res)=>{
    try {

    const { period = 'daily', startDate, endDate, page = 1 } = req.query;
    const perPage = 10;

    let filter = {};
    let start, end
       
      if (period === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'daily') {
      const today = new Date();
      start = new Date(today.setHours(0, 0, 0, 0));
      end = new Date(today.setHours(23, 59, 59, 999));
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'weekly') {
      start = new Date();
      start.setDate(start.getDate() - 7);
      end = new Date();
      filter.createdAt = { $gte: start, $lte: end };
    } else if (period === 'yearly') {
      start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      end = new Date();
      filter.createdAt = { $gte: start, $lte: end };
    }

    const totalOrders=await Order.countDocuments(filter)

    const orders=await Order.find(filter)
        .populate('user  items.product')
        .sort({createdAt :-1})
        .skip((page-1)*perPage)
        .limit(perPage)
        .lean()


        const summary={
            totalSales:await Order.countDocuments(filter),
            totalAmount:await Order.aggregate([
                {$match:filter},
                {$group:{_id:null,sum:{$sum:'$totalAmount'}}}
            ]),
            discountPrice:await Order.aggregate([
                {$match:filter},
                {$group:{_id:null,sum:{$sum:'$discountPrice'}}}
            ])
        }

    
        res.render('salesReport',{
             salesData:orders,
             summary: {
                 totalSales: summary.totalSales,
                 totalAmount: summary.totalAmount[0]?.sum || 0,
                 discountPrice: summary.discountPrice[0]?.sum || 0
                },
             totalPages: Math.ceil(totalOrders / perPage),
             currentPage: Number(page),
             period,
             startDate,
             endDate,
          
        })
    } catch (error) {
        console.error('error in getting salesReport')
    }
}

module.exports={
    getSalesReport
}