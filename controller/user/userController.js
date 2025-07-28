const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');


const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
   
    
  },

 
});



const loadHome = async (req, res) => {
  try {
    const user = req.session.userId ? await User.findById(req.session.userId).lean() : null;
    const categories = await Category.find().lean();

    const menPerfumesCategory = await Category.findOne({ name: "Men" }).select('_id').lean();
    const menPerfumes = menPerfumesCategory
      ? await Product.find({
          status: 'available',
          quantity: { $gte: 0 },
          category: menPerfumesCategory._id,
        })
        .populate('category')
        .populate('brand')
        .limit(4)
        .lean()
        .exec()
      : [];
   

    const womenPerfumesCategory = await Category.findOne({ name: "Women" }).select('_id').lean();
    const womenPerfumes = womenPerfumesCategory
      ? await Product.find({
          status: 'available',
          quantity: { $gte: 0 },
          category: womenPerfumesCategory._id,
        })
        .populate('category')
        .populate('brand')
        .limit(4)
        .lean()
        .exec()
      : [];

    console.log('Women Perfumes:', womenPerfumes);
    console.log('men Perfumes:', menPerfumes);
    res.render('home', { user, title: 'Home Page', menPerfumes, womenPerfumes });
  } catch (error) {
    console.error('Error in loadHome:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const loadSignup = async (req, res) => {
  try {
    console.log('load signup')
    res.render('signup', { title: 'Sign Up', error: null });
  } catch (error) {
    console.error('Error in loadSignup:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

  
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.googleId) {
        return res.json({ success: false, message: 'Email registered via Google.' });
      }
      return res.json({ success: false, message: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    
    req.session.tempUser = {
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpires,
    };
    console.log('your otp is',otp)
    await transporter.sendMail({
      to: email,
      subject: 'Your OTP for Signup',
      text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    });

    res.redirect('/verify-otp');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('signup', {
      title: 'Sign Up',
      message: 'Something went wrong. Please try again.',
    });
  }
};



const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};


const verifyOtp = async (req, res) => {
  try {
    const otpInput = req.body.otp?.toString();
    const tempUser = req.session.tempUser;

    if (!tempUser || !otpInput) {
      return res.status(400).json({ success: false, message: 'Session expired or OTP missing' });
    }

    const { name, email, password, otp, otpExpires } = tempUser;

    if (Date.now() > otpExpires) {
      return res.status(401).json({ success: false, message: 'OTP expired' });
    }

    if (otp !== otpInput) {
      return res.status(401).json({ success: false, message: 'Incorrect OTP' });
    }

   
    const newUser = new User({
      name,
      email,
      password,
      isVerified: true,
    });

    await newUser.save();


    req.session.userId = newUser._id;
    delete req.session.tempUser;

    res.json({ success: true, redirectUrl: '/' });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


const resendOtp=async(req,res)=>{
  try {
    const tempUser=req.session.tempUser;
    if(!tempUser || !tempUser.email){
      return res.json({
        success:false,
        message:'session expired.Please sign up again.',
      })
    }

    const newOtp=generateOtp()
    const otpExpires=Date.now() + 10*60*1000;
    
    req.session.tempUser.otp=newOtp;
    req.session.tempUser.otpExpires=otpExpires;


    await transporter.sendMail({
      to:tempUser.email,
      subject:'New otp for signup',
      text:`New OTP is ${newOtp}.Valid for 10 minutes`
    })

    console.log('Resend OTP to:', tempUser.email);
    console.log('New otp is:',newOtp)
    return res.json({success:true,message:'OTP resent succesfully'})

  } catch (error) {
    console.error('error in resendOtp',otp)
    return res.json({
      success:false,
      message:'server error,try again'
    })
    
  }
}




const pageNotFound = async (req, res) => {
  try {
    res.status(404).render('page-404', { title: 'Page Not Found' });
  } catch (error) {
    console.error('Error in pageNotFound:', error.stack);
    res.status(500).send('Server Error');
  }
};



// Load Login Page
const loadLogin = async (req, res) => {
  try {
    if(!req.session.user){
      res.render('login', { title: 'Login', error: null });
    }else{
      res.redirect('/')
    }
   
  } catch (error) {
    console.error('Error in loadLogin:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login request body:', { email });

  
    if (!email || !password) {
      return res.json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ isAdmin: false, email }).lean();
    console.log('User found:', user ? user.email : 'None'); 

    if (!user) {
      return res.json({
        success: false,
        message: 'Invalid email'
      });
    }

    if (!user.isVerified) {
      return res.json({
        success: false,
        message: 'User not verified. Please verify your OTP.'
      });
    }

    if (user.isBlocked) {
      return res.json({
        success: false,
        message: 'User is blocked by admin'
      });
    }

   
    if (!user.password) {
      return res.json({
        success: false,
        message: 'This account uses Google login. Please use Google to log in.'
      });
    }


    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match:', isMatch); 

    if (!isMatch) {
      return res.json({
        success: false,
        message: 'Invalid password'
      });
    }

   
    req.session.userId = user._id;
    console.log('Session userId set:', req.session.userId); 

    return res.json({
      success: true,
      redirectUrl: '/'
    });
  } catch (error) {
    console.error('Error in login controller:', error.stack);
    return res.json({
      success: false,
      message: 'Something went wrong. Please try again.'
    });
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error in logout:', err.stack);
        return res.redirect('/pageNotFound');
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  } catch (error) {
    console.error('Error in logout:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const loadShop = async (req, res) => {
  
  try {
  
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
    console.log('Products fetched:', products.map(p => ({ name: p.name, category: p.category?.name })));

       const filteredProducts = products.filter(product => {
      const isValid = product.brand && !product.brand.isBlocked &&
        product.category && product.category.isListed &&
        !product.isBlocked 

      return isValid;
    });


    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);
    

    const categories = await Category.find({ isListed: true }).lean();
    const brandIds = await Product.distinct('brand').lean();
    const brands = await Brand.find({ _id: { $in: brandIds }, isBlocked: false }).lean();
   const user = req.session.userId ? await User.findById(req.session.userId).lean() : null;

    res.render('shop', {
      user,
      products:filteredProducts,
      categories,
      brands,
      currentPage: page,
      totalPages,
      sort,
      categoryId,
      brandId,
      priceRange,
      searchQuery,
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

    console.log('searchProducts - categoryId:', categoryId); 
    console.log('searchProducts - brandId:', brandId); 

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




module.exports = {
  loadHome,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  pageNotFound,
  loadLogin,
  login,
  logout,
  loadShop,
  searchProducts,
};