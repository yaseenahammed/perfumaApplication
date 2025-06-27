const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');

const pageError=async(req,res)=>{
  res.render('admin-error')
}




const loadLogin = async (req, res) => {
  try {
    if (req.session.admin) {
      return res.redirect('/admin/dashboard');
    }
    const message = req.session.message;
    req.session.message = null;
    res.render('admin-login', {
       message
      });
  } catch (error) {
    console.error("An error occurred in loadLogin:", error);
    res.render('admin-Error');
  }
};




const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = admin._id; 
        return res.redirect('/admin/dashboard');
      } else {
        req.session.message = "Incorrect password";
        return res.redirect('/admin/login');
      }
    } else {
      req.session.message = "Admin not found";
      return res.redirect('/admin/login');
    }
  } catch (error) {
    console.log("Login error:", error);
    res.redirect('/admin/pageError');
  }
};



const loadDashboard = async (req, res) => {
 

      try {
        res.render('dashboard')
      } catch (error) {
        res.redirect('/admin/pageError')
      }
    
};


const logout=async(req,res)=>{
  try {
    req.session.destroy(err=>{
      if(err){
        console.log("an error occured in login",err)
        res.redirect('/admin/pageError')
      }else{
        res.redirect('/admin/login')
      }
      
    })
    
  } catch (error) {
    console.error('something went wrong in logout session',error)
    res.redirect('/admin/pageError')
    
  }

}








module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageError,
  logout
};
