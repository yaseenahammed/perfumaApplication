const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

// Configure nodemailer for sending OTP emails (update with your email service credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
    
  },

 
});



// Load Home Page
const loadHome = async (req, res) => {
  try {
    const user = req.session.user ? await User.findById(req.session.user).lean() : null;

    // Debug: Log all categories to check available category names
    const categories = await Category.find().lean();
    console.log('Available categories:', categories.map(cat => cat.name));

    // Fetch men's perfumes
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
    console.log('Men Perfumes:', menPerfumes);

    // Fetch women's perfumes
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

    // console.log('Women Perfumes:', womenPerfumes);
    // console.log('Rendering template: user/home');


    res.render('home', { user, title: 'Home Page', menPerfumes, womenPerfumes });
  } catch (error) {
    console.error('Error in loadHome:', error.stack);
    res.redirect('/pageNotFound');
  }
};

// Load Signup Page
const loadSignup = async (req, res) => {
  try {
    res.render('signup', { title: 'Sign Up', error: null });
  } catch (error) {
    console.error('Error in loadSignup:', error.stack);
    res.redirect('/pageNotFound');
  }
};

// Handle Signup
const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log(req.body);

  const findUser = await User.findOne({ email });
    if (findUser) {
      if (findUser.googleId) {
        return res.json({ success: false, message: 'This email is registered via Google. Please login using Google.' })
      } else {
        return res.json({ success: false, message: "User with this email already exists" })
      }

    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.render('signup', {
        title: 'Sign Up',
        message: 'Email already exists',
      });
    }
     
   

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();

    const user = new User({
      name,
      email,
      password: hashedPassword,
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000,
    });

    await user.save();

    await transporter.sendMail({
      to: email,
      subject: 'Your OTP for Signup',
      text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    });

    console.log('Your OTP is', otp);

    //  Store userId in session 
    req.session.userId = user._id;

    res.redirect('/verify-otp');
  } catch (error) {
    console.error('Error in signup controller:', error);

    res.render('signup', {
      title: 'Sign Up',
      message: 'Something went wrong. Please try again.',
    });
  }
};


// Function to generate OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit string OTP
};

// Controller to verify OTP
const verifyOtp = async (req, res) => {
  try {
    const otp = req.body?.otp?.toString();
    const userId = req.session.userId;

    console.log(" OTP from client:", otp);
    console.log(" Session userId:", userId);

    if (!otp || !userId) {
      return res.status(400).json({
        success: false,
        message: "Session expired or OTP missing.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    console.log(" OTP in DB:", user.otp);
    console.log(" OTP expires at:", user.otpExpires);

    if (user.otpExpires && user.otpExpires < Date.now()) {
      return res.status(401).json({
        success: false,
        message: "OTP expired.",
      });
    }

    if (user.otp?.toString() !== otp) {
      return res.status(401).json({
        success: false,
        message: "Incorrect OTP.",
      });
    }

    // OTP is valid
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    const dbUser = await User.findById(user._id);
    console.log("Saved to DB:", dbUser);

    return res.json({
      success: true,
      redirectUrl: "/login",
    });
  } catch (err) {
    console.error(" Verify OTP Error:", err);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};





// Resend OTP
const resendOtp = async (req, res) => {
  try {
    console.log("resendOtp function triggered");

    const userId = req.session.userId || req.session.tempUser;
    console.log("Session userId:", userId);

    if (!userId) {
      return res.json({ success: false, message: "Session expired. Please sign up again." });
    }

    const user = await User.findById(userId);
    console.log("User fetched:", user?.email);

    if (!user) {
      return res.json({ success: false, message: "User not found." });
    }

    const otp = generateOtp();
    console.log('Generated OTP:', otp);  // <-- This should show up now

    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    await transporter.sendMail({
      to: user.email,
      subject: 'Your New OTP for Signup',
      text: `Your new OTP is ${otp}. It is valid for 10 minutes.`,
    });

    console.log("OTP email sent");

    return res.json({ success: true, message: "OTP resent successfully" });

  } catch (error) {
    console.error('Error in resendOtp:', error.stack);
    return res.json({ success: false, message: "Server error. Please try again later." });
  }
};


// Load Page Not Found
const pageNotFound = async (req, res) => {
  try {
    res.status(404).render('pageNotFound', { title: 'Page Not Found' });
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

// Handle Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({isAdmin:0,email:email });
    if (!user || !user.isVerified) {
      return res.render('login', { title: 'Login', error: 'Invalid email or user not verified' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', { title: 'Login', error: 'Invalid password' });
    }

    req.session.user = user._id;
    res.redirect('/');

  } catch (error) {
    console.error('Error in login:', error.stack);
    res.render('login', { title: 'Login', error: 'Something went wrong' });
  }
};

// Handle Logout
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

// Load Shop Page
const loadShop = async (req, res) => {
  console.log('loadShop route accessed');
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const sort = req.query.sort || 'default';
    let categoryId = req.query['category[]'] || req.query.category || [];
    let brandId = req.query['brand[]'] || req.query.brand || [];
    const priceRange = req.query.price || '';
    const searchQuery = req.query.query || '';

    // Ensure categoryId and brandId are arrays
    if (!Array.isArray(categoryId)) categoryId = categoryId ? [categoryId] : [];
    if (!Array.isArray(brandId)) brandId = brandId ? [brandId] : [];

    console.log('loadShop - categoryId:', categoryId); // Debug
    console.log('loadShop - brandId:', brandId); // Debug

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
    console.log('new products', products);
    console.log('Products with images:', products.map(p => ({ name: p.name, productImages: p.productImages })));

    const totalProducts = await Product.countDocuments(query);
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

// Search Products
const searchProducts = async (req, res) => {
  try {
    const { query, sort } = req.body;
    let categoryId = req.body.category || []; // Expect category as an array
    let brandId = req.body.brand || []; // Expect brand as an array
    const priceRange = req.body.price || '';
    const page = 1;
    const limit = 9;

    // Ensure categoryId and brandId are arrays
    if (!Array.isArray(categoryId)) categoryId = categoryId ? [categoryId] : [];
    if (!Array.isArray(brandId)) brandId = brandId ? [brandId] : [];

    console.log('searchProducts - categoryId:', categoryId); // Debug
    console.log('searchProducts - brandId:', brandId); // Debug

    let searchQuery = { status: 'available', quantity: { $gte: 0 } };
    if (categoryId.length > 0) searchQuery.category = { $in: categoryId }; // Use $in for multiple categories
    if (brandId.length > 0) searchQuery.brand = { $in: brandId }; // Use $in for multiple brands
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
      categoryId, // Pass as array
      brandId, // Pass as array
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