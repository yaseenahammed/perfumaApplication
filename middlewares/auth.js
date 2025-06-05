const User=require('../models/userSchema')

const userAuth = async (req, res, next) => {
  console.log("userAuth middleware triggered", { user: req.user, sessionUser: req.session.user, session: req.session });

  if (req.user || req.session.user) {
    try {
      const userId = req.user ? req.user._id : req.session.user;
      const user = await User.findById(userId);
      if (user && !user.isBlocked) {
        req.user = user; // Ensure req.user is set for downstream middleware
        next();
      } else {
        console.log("User is blocked or not found:", user);
        res.redirect('/login');
      }
    } catch (error) {
      console.error("Error in userAuth middleware:", error);
      res.status(500).send('Internal Server Error');
    }
  } else {
    console.log("No user in req.user or req.session.user. Redirecting to login.");
    res.redirect('/login');
  }
};






const adminAuth = async (req, res, next) => {
  console.log("adminAuth middleware triggered");

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





module.exports={
    userAuth,
    adminAuth
}