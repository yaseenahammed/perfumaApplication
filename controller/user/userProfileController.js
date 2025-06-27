const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const Order=require('../../models/orderSchema')
const nodemailer = require('nodemailer');
require('dotenv').config();



const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  
  },
});


const userProfile=async(req,res)=>{
  try {
   const userId=req.session.userId
    const user=await User.findById(userId)
    const orders = await Order.find({ user: userId });
   
      res.render('user-profile',{
        user,
        orders
      })
    
  } catch (error) {
    console.error('an error occured in userProfile rendering')
  }
}

const getEditProfile=async(req,res)=>{
    try {
        const userId=req.session.userId
        const user=await User.findById(userId).lean()

        
        res.render('edit-profile',{
           
           user,
           
        })
    } catch (error) {
        console.error('error occured in getEditProfile:',error)
    }
}


const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.session.userId);

    user.name = name || user.name;

    if (req.file) {
      user.profileImage = req.file.path; 
    }

    await user.save();
    console.log("image:",req.file)

    console.log('Updated profile:', user);
    res.redirect('/userProfile');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('Server error');
  }
};


const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (order.userId.toString() === req.user.id) {
      order.status = 'Cancelled';
      await order.save();
    }
    res.redirect('/userProfile');
  } catch (error) {
    res.status(500).send('Server error');
  }
};


const userAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.render('user-address', { user }); 
  } catch (error) {
    console.error('Error in user-address page:', error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const addAddress = async (req, res) => {
  try {
    const { street, city, state, zip, country } = req.body;

    const user = await User.findById(req.session.userId); 

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.addresses.push({ street, city, state, zip, country });

    await user.save();
    console.log("Address added", user.addresses);

    
    res.redirect('/user-address');
  } catch (error) {
    console.error("Error in addAddress:", error);
    res.status(500).json({ message: "Internal Server Error" }); 
  }
};


const editAddress = async (req, res) => {
  try {
    const { addressId, street, city, state, zip, country } = req.body;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.addresses[addressId] = { street, city, state, zip, country };
    await user.save();
    res.redirect('/user-address');
  } catch (error) {
    console.error("Error in editAddress:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.addresses.splice(req.params.index, 1);
    await user.save();
    res.redirect('/user-address');
  } catch (error) {
    console.error("Error in deleteAddress:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const sendEmailOtp = async (req, res) => {
  try {
    const { newEmail } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.otp = otp;
    req.session.newEmail = newEmail;
    req.session.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    const mailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: newEmail,
      subject: 'Email Verification OTP',
      text: `Your OTP for email verification is ${otp}. It expires in 10 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error in sendEmailOtp:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.session.otp !== otp || Date.now() > req.session.otpExpires) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

  
    const existingUser = await User.findOne({ email: req.session.newEmail });
    if (existingUser) {
      return res.status(409).json({ message: "This email is already in use" });
    }

    user.email = req.session.newEmail;

   
    delete req.session.otp;
    delete req.session.newEmail;
    delete req.session.otpExpires;

    await user.save();
    console.log("your otp is:",req.session.otp)

    res.status(200).json({ message: "Email updated successfully" });

  } catch (error) {
    console.error("Error in verifyEmailOtp:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare currentPassword against the hashed password in DB
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.redirect('/user-address');
  } catch (error) {
    console.error("Error in changePassword:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports={
    userProfile,
    getEditProfile,
    updateProfile,
    cancelOrder,
    userAddress,
    addAddress,
    deleteAddress,
    editAddress,
    sendEmailOtp,
    verifyEmailOtp,
    changePassword
}