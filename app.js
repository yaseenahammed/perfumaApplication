const express=require('express')
const app=express()
const path=require('path')
const env=require('dotenv').config();
const db=require('./config/db')
const flash = require('connect-flash');
const userRouter=require('./routes/userRouter')
const adminRouter=require('./routes/adminRouter')
const {cartMiddleware,pageNotFound,globalErrorHandler}=require('./middlewares/auth')
const session=require('express-session')
const methodOverride = require('method-override');
const User=require('./models/userSchema')
const passport=require('./config/passport')
const nocache=require('nocache')
const logger = require('./helpers/logger');



db()
app.use(nocache())
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(methodOverride('_method'));



app.set("view engine","ejs");
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')))
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));



app.use(
  session({
    secret:process.env.SESSION_SECRET ,
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




app.use(cartMiddleware)

app.use('/',userRouter);
app.use('/admin',adminRouter)


// 404 handler 
app.use(pageNotFound);
// Global error handler
app.use(globalErrorHandler);





app.listen(process.env.PORT,()=>{
    logger.info('server running')
})

module.exports=app;