const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const Coupon=require('../../models/couponSchema')
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../../helpers/logger');
const { handleReferralCoupon } = require("../../helpers/referralHelper");
const passport = require('../../config/passport');
const express = require('express');
const router = express.Router();


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

   
    res.render('home', { 
      user,
       title: 'home',
       menPerfumes,
      womenPerfumes
     });
  } catch (error) {
    logger.error('Error in loadHome:', error.stack);
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
    logger.error('Error in loadSignup:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const signup = async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

  
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.googleId) {
        return res.json({ success: false,
        message: 'Email registered via Google.Please enter with google account' ,
        redirectUrl:'/login'
      });
      }
      return res.json({ success: false, message: 'Email already exists.',redirectUrl:'/login' });
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
    logger.info('your otp is',otp)
    console.log('your otp is',otp)
    await transporter.sendMail({
      to: email,
      subject: 'Your OTP for Signup',
      text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    });

    res.json({ success: true, message: 'OTP sent to your email. Please verify.' ,redirectUrl:'/verify-otp'});
  } catch (err) {
    logger.error('Signup error:', err);
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

const referrerId = await handleReferralCoupon(referredBy);

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
    logger.error('OTP verification error:', err);
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

    logger.info('Resend OTP to:', tempUser.email);
    logger.info('New otp is:',newOtp)
    return res.json({success:true,message:'OTP resent succesfully'})

  } catch (error) {
    logger.error('error in resendOtp',error)
    return res.json({
      success:false,
      message:'server error,try again'
    })
    
  }
}


// Google Auth
const googleCallback = (req, res, next) => {
  passport.authenticate('google', async (err, user, info) => {
    if (err) {
      logger.error('Google Auth Error:', err);
      return next(err);
    }

    if (!user) {
      const errorMessage = info?.message || 'Google login failed';
      return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
    }

    req.logIn(user, async (err) => {   
      if (err) return next(err);

      if (!user.referralToken) {
        user.referralToken = generateReferralToken();
        await user.save();
      }

      if (!user.referredBy && req.session.referredBy) {
        const referrerId = await handleReferralCoupon(req.session.referredBy);
        user.referredBy = referrerId;
        await user.save();
      }

      delete req.session.referredBy;

      req.session.userId = user._id;
      return res.redirect('/');
    });
  })(req, res, next);
};





const pageNotFound = async (req, res) => {
  try {
    res.status(404).render('page-404', { title: 'Page Not Found' });
  } catch (error) {
    logger.error('Error in pageNotFound:', error.stack);
    res.status(500).send('Server Error');
  }
};




const loadLogin = async (req, res) => {
  try {
    if(!req.session.user){
      res.render('login', { title: 'Login', error: null });
    }else{
      res.redirect('/')
    }
   
  } catch (error) {
    logger.error('Error in loadLogin:', error.stack);
    res.redirect('/pageNotFound');
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    logger.info('Login request body:', { email });

  
    if (!email || !password) {
      return res.json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await User.findOne({ isAdmin: false, email }).lean();
    logger.info('User found:', user ? user.email : 'None'); 

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
    logger.info('Password match:', isMatch); 

    if (!isMatch) {
      return res.json({
        success: false,
        message: 'Invalid password'
      });
    }

   
    req.session.userId = user._id;
    logger.info('Session userId set:', req.session.userId); 

    return res.json({
      success: true,
      redirectUrl: '/'
    });
  } catch (error) {
    logger.error('Error in login controller:', error.stack);
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
        logger.error('Error in logout:', err.stack);
        return res.redirect('/pageNotFound');
      }
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  } catch (error) {
    logger.error('Error in logout:', error.stack);
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
  googleCallback,
  logout,
 
};