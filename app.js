const express=require('express')
const app=express()
const path=require('path')
const env=require('dotenv').config();
const db=require('./config/db')
const flash = require('connect-flash');
const userRouter=require('./routes/userRouter')
const adminRouter=require('./routes/adminRouter')
const session=require('express-session')
const User=require('./models/userSchema')
const passport=require('./config/passport')
const nocache=require('nocache')



db()
app.use(nocache())
app.use(express.json());
app.use(express.urlencoded({extended:true}));






app.set("view engine","ejs");
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')))
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));




app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, 
      maxAge: 10 * 60 * 1000, 
    },
  })
);



app.use(flash());






app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});


app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.query = req.query;
  next();
});






app.use('/',userRouter);
app.use('/admin',adminRouter)




app.listen(process.env.PORT,()=>{
    console.log('server running')
})

module.exports=app;