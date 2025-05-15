const User=require('../models/userSchema')


const userAuth=async(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user).then(data=>{
            if(data&& !data.isBlocked){
                next()
            }else{
                res.redirect('/login')

            }
        })
        .catch(error=>{
            console.log("Error in user auth middlewares",error)
            res.status(500).send('internal server error')
        })
        
    }
}



const adminAuth=async(req,res,next)=>{
    User.findOne({isAdmin:true}).then(data=>{
        if(data){
            next()
        }else{
            res.redirect('/admin-login')
        }
    })
    .catch(error=>{
        console.log("Error in admin auth middleware",error)
        res.status(500).send("internal server error")
    })
    
}


module.exports={
    userAuth,
    adminAuth
}