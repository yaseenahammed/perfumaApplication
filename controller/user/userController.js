const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const Coupon=require('../../models/couponSchema')
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');



function generateReferralToken() {
  return crypto.randomBytes(8).toString('hex'); 
}



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

   
    res.render('home', { user, title: 'Home Page', menPerfumes, womenPerfumes });
  } catch (error) {
    console.error('Error in loadHome:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const loadSignup = async (req, res) => {
  try {
 

    res.render('signup', { 
      title: 'Sign Up', error: null,
      referralToken: req.query.ref || ''
   
    });
      

  } catch (error) {
    console.error('Error in loadSignup:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const signup = async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

  
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
      referredBy:referredBy || null
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

    const { name, email, password, otp, otpExpires ,referredBy} = tempUser;

    if (Date.now() > otpExpires) {
      return res.status(401).json({ success: false, message: 'OTP expired' });
    }

    if (otp !== otpInput) {
      return res.status(401).json({ success: false, message: 'Incorrect OTP' });
    }

    const existingUser=await User.findOne({email})
    if(existingUser){
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

let referrerId = null;
if (referredBy) {
  const referrer = await User.findOne({ referralToken: referredBy });
  if (referrer) {
    referrerId = referrer._id;

    const couponCode = `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const coupon = new Coupon({
      couponCode,
      discountPrice: 10,
      minPrice: 100,
      expireOn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isList: true,
      status: true,
      userId: [referrer._id],
    });

    await coupon.save();

    await transporter.sendMail({
      to: referrer.email,
      subject: 'You earned a referral coupon!',
      text: `Congratulations! You received a referral coupon:\n\nCoupon Code: ${couponCode}\nDiscount: $10 off on orders over $100\nExpires: ${coupon.expireOn}`,
    });
  }
}

// Now create user
const newUser = new User({
  name,
  email,
  password,
  isVerified: true,
  referredBy: referrerId,
  referralToken: generateReferralToken(),
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
 
};