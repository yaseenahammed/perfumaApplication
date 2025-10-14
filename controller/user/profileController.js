const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const nodemailer = require('nodemailer');
require('dotenv').config();
const logger = require('../../helpers/logger');

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
      from: `Perfuma Support <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: 'Your OTP for Password Reset',
      text: `Your OTP is ${otp}. It is valid for 60 seconds.`,
      html: `<b><h4>Your OTP: ${otp}</h4><p>It is valid for 60 seconds.</p></b>`,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully:', info.messageId);
    return { success: true };
  } catch (error) {
    logger.error('Error sending email:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return { success: false, message: error.message };
  }
};

const getForgotPassword = async (req, res) => {
  try {
    res.render('forgot-password', { user: null, message: '' });
  } catch (error) {
    logger.error('Error in getForgotPassword:', error);
    res.redirect('/pageNotFound');
  }
};

const forgotEmailValid = async (req, res) => {
  try {
    const { email } = req.body;

    const findUser = await User.findOne({ email });

    if (findUser && findUser.googleId) {
      // Email registered with Google
      return res.render('forgot-password', {
        user: null,
        message: 'This email is registered via Google. Please login with Google instead.'
      });
    }

    if (findUser) {
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);

      if (emailSent) {
        req.session.userEmail = email;
        req.session.userOtp = otp;
        req.session.otpCreatedAt = Date.now();

        logger.info('Session set in forgotEmailValid:', req.session);

        req.session.save(err => {
          if (err) {
            logger.error('Session save error in forgotEmailValid:', err);
            return res.render('forgot-password', {
              user: null,
              message: 'Something went wrong. Please try again.'
            });
          }
          logger.info('Session saved in forgotEmailValid:', req.session);
          res.render('forgotPass-otp', { user: null, message: '' });
        });

        logger.info('OTP:', otp, 'for email:', email);
      } else {
        res.render('forgot-password', {
          user: null,
          message: 'Failed to send OTP. Please try again.'
        });
      }
    } else {
      res.render('forgot-password', {
        user: null,
        message: 'User with this email does not exist.'
      });
    }
  } catch (error) {
    logger.error('Error in forgotEmailValid:', error);
    res.redirect('/pageNotFound');
  }
};



const verifyForgotPassOtp = async (req, res) => {
  try {
    const enterOtp = req.body.otp;
    logger.info('Received OTP:', enterOtp, typeof enterOtp);
    logger.info('Session OTP:', req.session.userOtp, typeof req.session.userOtp);
    logger.info('Session before verification:', req.session);

    if (!req.session.userOtp || !req.session.userEmail || !req.session.otpCreatedAt) {
      return res.json({ success: false, message: 'Session expired or invalid' });
    }


    const otpAge = Date.now() - req.session.otpCreatedAt;
    if (otpAge > 60 * 1000) {
      delete req.session.userOtp;
      delete req.session.otpCreatedAt;
      req.session.save();
      return res.json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (String(enterOtp) === String(req.session.userOtp)) {
      req.session.otpVerified = true;
      delete req.session.userOtp;
      delete req.session.otpCreatedAt;
      req.session.save(err => {
        if (err) {
          logger.error('Session save error in verifyForgotPassOtp:', err);
          return res.status(500).json({ success: false, message: 'Session error' });
        }
        logger.info('Session saved in verifyForgotPassOtp:', req.session);
        res.json({ success: true, redirectUrl: '/reset-password' });
      });
    } else {
      res.json({ success: false, message: 'Invalid OTP' });
    }
  } catch (error) {
    logger.error('Error in verifyForgotPassOtp:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};


const getResetPassPage = async (req, res) => {
  try {
   
    if (!req.session.otpVerified || !req.session.userEmail) {
   
      return res.redirect('/forgot-password');
    }
    res.render('reset-password', { user: null, message: '' });
  } catch (error) {
    logger.error('Error rendering reset-password:', error);
    res.redirect('/pageNotFound');
  }
};

const resetPassword = async (req, res) => {
  try {
  
    if (!req.session.otpVerified || !req.session.userEmail) {
    
      return res.json({ success: false, message: 'Session expired or invalid. Please restart the process.' });
    }

    const { newPassword, confirmPassword } = req.body;
   

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
      if (err) logger.error('Session save error in resetPassword:', err);
    });

   
    res.json({ success: true, redirectUrl: '/login' });
  } catch (error) {
    logger.error('Error in resetPassword:', error);
    res.status(500).json({ success: false, message: 'An error occurred while resetting the password' });
  }
};

const resendOtp = async (req, res) => {
  try {


    const email = req.session.userEmail;
    if (!email) {
      logger.info('No userEmail in session');
      return res.render('forgot-password', {
        user: null,
        message: 'Session expired. Please enter your email again.',
      });
    }

    const findUser = await User.findOne({ email });
    if (!findUser) {
   
      return res.render('forgot-password', {
        user: null,
        message: 'User with this email does not exist',
      });
    }

    const otp = generateOtp();
    const emailResult = await sendVerificationEmail(email, otp);
    if (emailResult.success) {
      req.session.userOtp = otp;
      req.session.otpCreatedAt = Date.now();
      logger.info('New OTP generated in resendOtp:', otp);
      req.session.save(err => {
        if (err) {
          logger.error('Session save error in resendOtp:', err);
          return res.status(500).json({ success: false, message: 'Session error' });
        }
        res.json({ success: true, message: 'New OTP sent to your email' });
      });
    } else {
      res.json({ success: false, message: `Failed to send OTP: ${emailResult.message || 'Please try again.'}` });
    }
  } catch (error) {
    logger.error('Error in resendOtp:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
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