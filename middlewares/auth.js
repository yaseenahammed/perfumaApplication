const User=require('../models/userSchema')

const userAuth = async (req, res, next) => {
  console.log('userAuth middleware triggered', {
    sessionUserId: req.session.userId,
    session: req.session,
  });

  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId).lean();
      if (user && !user.isBlocked) {
        req.user = user; 
        console.log('User authenticated:', user.email);
        return next();
      } else {
        console.log('User is blocked or not found:', user);
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
    console.log('No userId in session.');
    req.flash('error', 'Please log in to continue');
return res.redirect('/login');

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