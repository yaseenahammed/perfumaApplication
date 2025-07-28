const User=require('../models/userSchema')

const userAuth = async (req, res, next) => {


  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      if (user && !user.isBlocked) {
        req.user = user; 

        return next();
      } else {
      
        req.session.destroy((err) => {
          if (err) {
            console.error('Error destroying session:', err);
          }
          return res.status(403).json({
            success: false,
            message: user && user.isBlocked ? 'User is blocked by admin' : 'User not found',
          });
        });
      }
    } catch (error) {
      console.error('Error in userAuth middleware:', error.stack);
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        return res.status(500).json({
          success: false,
          message: 'Something went wrong. Please log in again.',
        });
      });
    }
  } else {
   
    req.flash('error', 'Please log in to continue');
return res.redirect('/login');

  }
};

const isLogin=async (req,res,next)=>{
  try {
    const user=req.session.userId
    if(user){
     return res.redirect('/')
    }
    next()
  } catch (error) {
    console.error('error in middileware',error)
  }
}




const setUser = async (req, res, next) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId).lean();

      if (!user || user.isBlocked) {
        req.session.destroy(() => {});
        res.locals.user = null;

         return res.redirect('/');
      } else {
        res.locals.user = user;
      }
    } else {
      res.locals.user = null;
    }
  } catch (err) {
    console.error('setUser middleware error:', err);
    res.locals.user = null;
  }

  next();
};





const adminAuth = async (req, res, next) => {


  try {
    if (req.session.admin) {
      const admin = await User.findById(req.session.admin);

      if (admin && admin.isAdmin && !admin.isBlocked) {
        return next();
      } else {
        return res.redirect('/admin/login');
      }
    } else {
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.log("Error in admin auth middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};


const isAdmin=async (req,res,next)=>{
  try {
    const admin=req.session.admin
    if(admin){
      return res.redirect('/admin/dashboard')
    }
    next()
  } catch (error) {
    console.error('error in middleware',error)
  }
}


module.exports={
    userAuth,
    isLogin,
    adminAuth,
    isAdmin,
    setUser,
}