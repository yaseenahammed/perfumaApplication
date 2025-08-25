const Product=require('../../models/productSchema')
const Order=require('../../models/orderSchema')


const loadDashboard = async (req, res) => {
  try {

      const topProducts=await Order.aggregate([
        {$unwind:"$items"},
        {
            $group:{
                _id:'$items.product',
                totalSold:{$sum:'$items.quantity'}
            }
        },
        {$sort:{totalSold:-1}},
        {$limit:5},
        {
            $lookup:{
                from:'products',
                localField:'_id',
                foreignField:'_id',
                as:'product'
            }
        },
        {$unwind:"$product"}
      ])

    const formattedTopProducts = topProducts.map(p => ({
  name: p.product.name,
  sales: p.totalSold,
  revenue: p.totalSold * p.product.salePrice
}));

       
const topBrands = await Order.aggregate([
  { $unwind: "$items" },
  {
    $lookup: {
      from: "products",
      localField: "items.product",
      foreignField: "_id",
      as: "product"
    }
  },
  { $unwind: "$product" },
  {
    $lookup: {
      from: "brands",
      localField: "product.brand",
      foreignField: "_id",
      as: "brand"
    }
  },
  { $unwind: "$brand" },
  {
    $group: {
      _id: "$brand._id",
      name: { $first: "$brand.name" },
      totalSold: { $sum: "$items.quantity" },
      grossRevenue: { $sum: { $multiply: ["$items.quantity", "$product.salePrice"] } }
    }
  },
  { $sort: { totalSold: -1 } },
  { $limit: 5 }
]);

const formattedTopBrands = topBrands.map(b => ({
  name: b.name,
  sales: b.totalSold,
  revenue: b.grossRevenue
}));



const topCategories = await Order.aggregate([
  { $unwind: '$items' },
  {
    $lookup: {
      from: 'products',
      localField: 'items.product',
      foreignField: '_id',
      as: 'product'
    }
  },
  { $unwind: '$product' }, 
  {
    $lookup: {
      from: 'categories',
      localField: 'product.category',
      foreignField: '_id',
      as: 'category'
    }
  },
  { $unwind: '$category' },
  {
    $group: {
      _id: '$category._id',
      name: { $first: "$category.name" },
      totalSold: { $sum: "$items.quantity" },
      grossRevenue: { $sum: { $multiply: ["$items.quantity", "$product.salePrice"] } }
    }
  }
]);


const formattedTopCategories=topCategories.map(c=>({
    name:c.name,
    sales:c.totalSold,
    revenue:c.grossRevenue

}))


        res.render('dashboard',{
            topProducts:formattedTopProducts,
            topBrands:formattedTopBrands,
            topCategories:formattedTopCategories
        })
      } catch (error) {
        console.error('error in load dashBoard',error)
      }
    
};

module.exports={
    loadDashboard
}