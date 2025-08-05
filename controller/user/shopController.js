const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const Wishlist=require('../../models/wishlistSchema')

const loadShop = async (req, res) => {
  try {
    const userId = req.session.userId;

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const sort = req.query.sort || 'default';
    let categoryId = req.query['category[]'] || req.query.category || [];
    let brandId = req.query['brand[]'] || req.query.brand || [];
    const priceRange = req.query.price || '';
    const searchQuery = req.query.query || '';

    if (!Array.isArray(categoryId)) categoryId = categoryId ? [categoryId] : [];
    if (!Array.isArray(brandId)) brandId = brandId ? [brandId] : [];

    let query = { status: 'available', quantity: { $gte: 0 } };
    if (categoryId.length > 0) query.category = { $in: categoryId };
    if (brandId.length > 0) query.brand = { $in: brandId };
    if (priceRange) {
      if (priceRange === 'under500') query.salePrice = { $lte: 500 };
      else if (priceRange === '500-1000') query.salePrice = { $gte: 500, $lte: 1000 };
      else if (priceRange === '1000-1500') query.salePrice = { $gte: 1000, $lte: 1500 };
      else if (priceRange === 'above1500') query.salePrice = { $gte: 1500 };
    }
    if (searchQuery) query.name = { $regex: searchQuery, $options: 'i' };

    let sortOption = {};
    if (sort === 'priceLowToHigh') sortOption = { salePrice: 1 };
    else if (sort === 'priceHighToLow') sortOption = { salePrice: -1 };
    else if (sort === 'nameAsc') sortOption = { name: 1 };
    else if (sort === 'nameDesc') sortOption = { name: -1 };
    else sortOption = { createdAt: -1 };

    const products = await Product.find(query)
      .populate('category')
      .populate('brand')
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    const filteredProducts = products.filter(product => {
      const isValid = product.brand && !product.brand.isBlocked &&
        product.category && product.category.isListed &&
        !product.isBlocked;
      return isValid;
    });

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ isListed: true }).lean();
    const brandIds = await Product.distinct('brand').lean();
    const brands = await Brand.find({ _id: { $in: brandIds }, isBlocked: false }).lean();

   
    const user = userId ? await User.findById(userId).lean() : null;

  
    if (user) {
      req.session.user = user;
      req.session.userId = user._id;
    }

   
    let wishlistItems = [];
    if (userId) {
      const wishlist = await Wishlist.find({ user: userId }).populate('product');
      wishlistItems = wishlist.map(item => ({
        _id: item._id,
        product: {
          _id: item.product._id,
          name: item.product.name,
          salePrice: item.product.salePrice,
          productImages: item.product.productImages,
        },
      }));
    }

  
    res.render('shop', {
      user,
      products: filteredProducts,
      categories,
      brands,
      currentPage: page,
      totalPages,
      sort,
      categoryId,
      brandId,
      priceRange,
      searchQuery,
      wishlistItems
    });

   
 

  } catch (error) {
    console.error('Error in loadShop:', error.stack);
    res.redirect('/pageNotFound');
  }
};





const searchProducts = async (req, res) => {
  try {
    const { query, sort } = req.body;
    let categoryId = req.body.category || []; 
    let brandId = req.body.brand || []; 
    const priceRange = req.body.price || '';
    const page = 1;
    const limit = 9;

 
    if (!Array.isArray(categoryId)) categoryId = categoryId ? [categoryId] : [];
    if (!Array.isArray(brandId)) brandId = brandId ? [brandId] : [];



    let searchQuery = { status: 'available', quantity: { $gte: 0 } };
    if (categoryId.length > 0) searchQuery.category = { $in: categoryId }; 
    if (brandId.length > 0) searchQuery.brand = { $in: brandId }; 
    if (priceRange) {
      if (priceRange === 'under500') searchQuery.salePrice = { $lte: 500 };
      else if (priceRange === '500-1000') searchQuery.salePrice = { $gte: 500, $lte: 1000 };
      else if (priceRange === '1000-1500') searchQuery.salePrice = { $gte: 1000, $lte: 1500 };
      else if (priceRange === 'above1500') searchQuery.salePrice = { $gte: 1500 };
    }
    if (query) searchQuery.name = { $regex: query, $options: 'i' };

    let sortOption = {};
    if (sort === 'priceLowToHigh') sortOption = { salePrice: 1 };
    else if (sort === 'priceHighToLow') sortOption = { salePrice: -1 };
    else if (sort === 'nameAsc') sortOption = { name: 1 };
    else if (sort === 'nameDesc') sortOption = { name: -1 };
    else sortOption = { createdAt: -1 };

    const products = await Product.find(searchQuery)
      .populate('category')
      .populate('brand')
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec();

    

    const totalProducts = await Product.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ isListed: true }).lean();
    const brandIds = await Product.distinct('brand').lean();
    const brands = await Brand.find({ _id: { $in: brandIds } }).lean();
    const user = req.session.user ? await User.findById(req.session.user).lean() : null;

    res.render('shop', {
      user,
      products,
      categories,
      brands,
      currentPage: page,
      totalPages,
      sort: sort || 'default',
      categoryId, 
      brandId,
      priceRange,
      searchQuery: query || '',
    });
  } catch (error) {
    console.error('Error in searchProducts:', error.stack);
    res.redirect('/pageNotFound');
  }
};



module.exports={
loadShop,
searchProducts
}
