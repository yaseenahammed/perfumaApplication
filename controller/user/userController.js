const User = require('../../models/userSchema');
const env=require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt=require('bcrypt')




const loadSignup=async(req,res)=>{
    try{
        res.render('signup')
    }catch(error){
        res.send("page not found")
    }
}



function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString()
}

async function sendVerificationEmail(email, otp) {
    try {
        console.log("NODEMAILER_EMAIL:", process.env.NODEMAILER_EMAIL);
        console.log("NODEMAILER_PASSWORD:", process.env.NODEMAILER_PASSWORD);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`

            
        });
       
        return info.accepted.length > 0;

    } catch (error) {
        console.log("Error sending email:", error);
        return false;
    }
}


   

const signup = async (req, res) => {
  try {
    console.log(req.body);

    const { name, email, password, confirmPassword } = req.body;

    // 1. Password match check
    if (password !== confirmPassword) {
      return res.render('signup', { message: "Passwords do not match" });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup', { message: "User already exists" });
    }

    // 3. Generate OTP and send email
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      console.log('Email sending failed');
      return res.render('signup', { message: "Failed to send verification email" });
    }

  console.log("email sent successfully:",otp)

    // 4. Save data temporarily in session
    req.session.userOtp = otp;
    req.session.userData = { name, email, password };

    // 5. Render OTP verification page
    res.render('verify-otp');

  } catch (error) {
    console.error('Signup error:', error);
    res.redirect('/pageNotFound');
  }
};




  




const pageNotFound = async(req,res)=>{
    try{
        res.render('page-404')
        
    }catch(error){
        res.redirect('/pageNotFound')
    }
}





const loadHome = async (req, res) => {
  try {
    if (req.session.user) {
      const userData = await User.findById(req.session.user);
      res.render('home', { user: userData });
    } else {
      res.render('home', { user: null });
    }
  } catch (error) {
    console.error("Error in loadHome:", error);
    res.status(500).send("Something went wrong");
  }
};





const securePassword=async (password)=>{
    try{
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash

    }catch (error) {
    console.error("Password hash error:", error);
    throw new Error("Hashing failed");
}

}








const verifyOtp=async(req,res)=>{
    try{
const {otp}=req.body;
console.log(otp)
 
if (otp === req.session.userOtp) {
  const user = req.session.userData;
  const passwordHash = await securePassword(user.password);

  const saveUserData = new User({
    name: user.name,
    email: user.email,
    password: passwordHash,
  });
  await saveUserData.save();

  req.session.user = saveUserData._id;
  req.session.userOtp = undefined;      // clear OTP
  req.session.userData = undefined;    // clear temp data

  res.json({ success: true, redirectUrl: '/' });
}

   
else{
    res.status(400).json({success:false,message:"Invalid OTP, Try again"})
}

    }catch(error){
        console.error("error verifying OTP",error)
        res.status(500).json({success:false,message:"An error occured"})

    }
}




const resendOtp=async(req,res)=>{
    try{
const {email}=req.session.userData
if(!email){
     return res.status(400).json({success:false,message:"Email not found in the session"})

}
const otp=generateOtp();
req.session.userOtp=otp;

const emailSent=await sendVerificationEmail(email,otp);
if(emailSent){
    console.log("Resend OTP:",otp);
    res.status(200).json({success:true,message:"OTP Resend Successfully"})
}else{
    res.status(500).json({success:false,message:"Failed to resend OTP.Try again"})
}
}catch(error){
        console.log("Error Resendinf OTP",error);
        res.status(500).json({success:false,message:"Failed to Resend Otp.Try again"})
    }
    }



const loadLogin=async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render('login')
        }else{
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}





const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ isAdmin: 0, email });

    if (!findUser) {
      return res.render('login', { message: "Invalid email or password" });
    }

    if (findUser.isBlocked) {
      return res.render('login', { message: "User is blocked by admin" });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render('login', { message: "Invalid email or password" });
    }

    req.session.user = findUser._id;
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { message: "An error occurred. Please try again later." });
  }
};



const logout=async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destructioin error");
                return res.redirect('/pageNotFound')
            }
            return res.redirect('login')
        })
    } catch (error) {
        console.log("Logout error",error)
        res.redirect('/pageNotFound')
        
    }

}





module.exports={
    loadHome,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout
}


