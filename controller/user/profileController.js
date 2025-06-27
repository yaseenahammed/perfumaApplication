const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
require('dotenv').config();

function generateOtp() {
  const digits = '1234567890';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

const sendVerificationEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: 'Your OTP for password reset',
      text: `Your OTP is ${otp}`,
      html: `<b><h4>Your OTP: ${otp}</h4></b>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

const getForgotPassword = async (req, res) => {
  try {
    res.render('forgot-password', { user: null, message: '' });
  } catch (error) {
    console.error('Error in getForgotPassword:', error);
    res.redirect('/pageNotFound');
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Email received in forgotEmailValid:', email);
    const findUser = await User.findOne({ email });
    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (emailSent) {
        req.session.userEmail = email;
        req.session.userOtp = otp;
        console.log('Session set in forgotEmailValid:', req.session); 
        req.session.save(err => {
          if (err) {
            console.error('Session save error in forgotEmailValid:', err);
            return res.status(500).json({ success: false, message: 'Session error' });
          }
          console.log('Session saved in forgotEmailValid:', req.session);
          res.render('forgotPass-otp', { user: null, message: '' });
        });
        console.log('OTP:', otp, 'for email:', email);
      } else {
        res.json({ success: false, message: 'Failed to send OTP. Please try again' });
      }
    } else {
      res.render('forgot-password', {
        user: null,
        message: 'User with this email does not exist',
      });
    }
  } catch (error) {
    console.error('Error in forgotEmailValid:', error);
    res.redirect('/pageNotFound');
  }
};

const verifyForgotPassOtp = async (req, res) => {
  try {
    const enterOtp = req.body.otp;
    console.log('Received OTP:', enterOtp, typeof enterOtp);
    console.log('Session OTP:', req.session.userOtp, typeof req.session.userOtp);
    console.log('Session before verification:', req.session);

    if (!req.session.userOtp || !req.session.userEmail) {
      return res.json({ success: false, message: 'Session expired or invalid' });
    }

    if (String(enterOtp) === String(req.session.userOtp)) {
      console.log('Session before setting otpVerified:', req.session);
      req.session.otpVerified = true;
      delete req.session.userOtp;
      req.session.save(err => {
        if (err) {
          console.error('Session save error in verifyForgotPassOtp:', err);
          return res.status(500).json({ success: false, message: 'Session error' });
        }
        console.log('Session saved in verifyForgotPassOtp:', req.session);
        res.json({ success: true, redirectUrl: '/reset-password' });
      });
    } else {
      res.json({ success: false, message: 'OTP not matching' });
    }
  } catch (error) {
    console.error('Error in verifyForgotPassOtp:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

const getResetPassPage = async (req, res) => {
  try {
    console.log('Session in getResetPassPage:', req.session);
    if (!req.session.otpVerified || !req.session.userEmail) {
      console.log('Redirecting to /forgot-password due to missing otpVerified or userEmail');
      return res.redirect('/forgot-password');
    }
    res.render('reset-password', { user: null, message: '' });
  } catch (error) {
    console.error('Error rendering reset-password:', error);
    res.redirect('/pageNotFound');
  }
};

const resetPassword = async (req, res) => {
  try {
    console.log('Session in resetPassword:', req.session);
    if (!req.session.otpVerified || !req.session.userEmail) {
      console.log('Session check failed. otpVerified:', req.session.otpVerified, 'userEmail:', req.session.userEmail);
      return res.json({ success: false, message: 'Session expired or invalid. Please restart the process.' });
    }

    const { newPassword, confirmPassword } = req.body;
    console.log('Request body in resetPassword:', req.body);

    if (!newPassword || !confirmPassword) {
      return res.json({ success: false, message: 'Both password fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 6) {
      return res.json({ success: false, message: 'Password must be at least 8 characters long' });
    }

  
    const user = await User.findOne({ email: req.session.userEmail });
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

 
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    
    user.password = hashedPassword;
    await user.save();

 
    delete req.session.otpVerified;
    delete req.session.userEmail;
    req.session.save(err => {
      if (err) console.error('Session save error in resetPassword:', err);
    });

   
    res.json({ success: true, redirectUrl: '/login' });
  } catch (error) {
    console.error('Error in resetPassword:', error);
    res.status(500).json({ success: false, message: 'An error occurred while resetting the password' });
  }
};

const resendOtp = async (req, res) => {
  try {
    console.log('resendOtp triggered');
    console.log('Session:', req.session);

    const userId = req.session.userId || req.session.tempUser;
    console.log('Session userId:', userId);

    if (!userId) {
      console.log('No userId');
      return res.status(401).json({ success: false, message: 'Session expired. Please sign up again.' });
    }

    if (!mongoose.isValidObjectId(userId)) {
      console.log('Invalid userId:', userId);
      return res.status(400).json({ success: false, message: 'Invalid session data.' });
    }

    const user = await User.findById(userId);
    console.log('User:', user?.email || 'None');

    if (!user) {
      console.log('User not found');
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const otp = generateOtp();
    console.log('OTP:', otp);

    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();
    console.log('User updated:', user.email);

    await new Promise((resolve, reject) => {
      transporter.verify((error) => {
        if (error) {
          console.error('Transporter error:', error);
          reject(error);
        } else {
          console.log('Transporter ready');
          resolve();
        }
      });
    });

    await transporter.sendMail({
      to: user.email,
      subject: 'Your New OTP for Signup',
      text: `Your new OTP is ${otp}. It is valid for 10 minutes.`,
    });
    console.log('Email sent to:', user.email);

    return res.json({ success: true, message: 'OTP resent successfully' });
  } catch (error) {
    console.error('resendOtp error:', error.stack);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};



module.exports = {
  getForgotPassword,
  forgotEmailValid,
  sendVerificationEmail,
  generateOtp,
  verifyForgotPassOtp,
  getResetPassPage,
  resetPassword,
  resendOtp,
 
};