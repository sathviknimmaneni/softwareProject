require('dotenv').config()
const express = require('express');
const bodyParser=require('body-parser');
const ejs=require('ejs');
const mongoose=require('mongoose');
const session=require('express-session');
var cookieParser = require('cookie-parser');
const passport=require('passport');
const passportLocalMongo=require('passport-local-mongoose');
var flash = require('connect-flash');
const { Timer } = require('easytimer');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
 app.use(express.static("public"));
 app.use(cookieParser('secret'));
 app.use(session({
   secret:process.env.SECRET,
   resave:false,
   saveUninitialized: false,
 }));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

//mongoose connnection and schemas
//mongoose.connect("mongodb+srv://Sathvik:"+process.env.DBKEY+"@cluster0-deldk.mongodb.net/auctionDB",{useNewUrlParser:true, useUnifiedTopology: true});
mongoose.connect("mongodb://localhost:27017/auctionDB",{useNewUrlParser:true, useUnifiedTopology: true});
mongoose.set("useCreateIndex",true);

const auctionSchema=new mongoose.Schema({
  startedBy:String,
  name:String,
  category:String,
  basePrice:Number,
  duration:Number,
  description:String,
  startedOn:Date,
  currentBid:Number,
  currentBidder:String,
  participants:[{
    type:mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique:true
  }]
});
auctionSchema.plugin(passportLocalMongo, { usernameUnique: false});

const userSchema=new mongoose.Schema({
  username:String,
  email:String,
  password:String,
  joinedAuction:[{
    type:mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    unique:true
  }]
});
userSchema.plugin(passportLocalMongo,{usernameField: "email"});

const Auction=mongoose.model("Auction",auctionSchema);
const User=mongoose.model("User",userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// starting route
app.get('/',function(req,res){
  if(req.isAuthenticated()){
    req.flash("Welcome","welcome back,")
    res.redirect("/home");
  }else{
    res.render("starting");
  }
});

//login route
app.get('/login',function(req,res){
    res.render('login',{loginMessage:req.flash("loginError")});
});

app.post('/login',function(req,res){
  user = new User({
    email:req.body.email,
    password:req.body.password
  });

    req.login(user,function(err){
      if(err){
        req.flash("loginError","Invalid Username or Password");
        res.redirect('/login');
      }else{
          passport.authenticate("local",{failureFlash:true,failureRedirect: "/login"})(req,res,function(){
          res.redirect("/home");
        });
    }
});
});

//signup route
app.get('/signup',function(req,res){
  res.render('signup');
})

app.post('/signup',function(req,res){
  User.register({email:req.body.email,username:req.body.username},req.body.password,function(err,user){
  if(err){
    console.log(err);
    res.redirect('/signup');
  }else{
    passport.authenticate("local")(req,res,function(){
      req.flash("successSignUp","Your acount has been succesfully created..")
      res.redirect('/home');
    });
  }
  });
})

//home route
app.get('/home',function(req,res){
  if(req.isAuthenticated()){
    Auction.find({}, function(err, items){
        if(err){
        console.log(err);
        }else{
           res.render("home", {
             post: items,
             AName:req.user.username,
             welcomeMessage:req.flash("Welcome"),
             startedAuction:req.flash("auctionStarted"),
             unableBid:req.flash("errorBid"),
             placedBid:req.flash("successBid"),
             signedUp:req.flash("successSignUp")
             });
         }
       });
  }else{
    res.redirect("/login");
  }
});

//auctionstarting route
app.get('/startauction',function(req,res){
  if(req.isAuthenticated()){
  res.render('auction_items');
}else{
res.redirect("/login");
}
});

app.post("/startauction", function(req,res){
  if(req.isAuthenticated()){
  const newItem=new Auction({
    startedBy:req.user.id,
    name:req.body.itemName,
    category:req.body.itemCategory,
    basePrice:req.body.basePrice,
    currentBid:req.body.basePrice,
    duration:req.body.itemDuration,
    description:req.body.itemDescription,
    startedOn:new Date()
  });

  newItem.save(function(err){
     if (!err){
       req.flash("auctionStarted","succesfully started Auction");
       res.redirect("/home");
     }else{
       console.log(err);
     }
   });
 }else{
   res.redirect("/");
 }
})

//bidupdate and validation routes
app.get("/bidUpdate",function(req,res){
  res.render("bidUpdate");
});

app.post("/bidUpdate",function(req,res){
console.log(req.body.bidAmount);
});

//view current auction routes
app.get('/viewbids',function(req,res){
  if(req.isAuthenticated()){
  Auction.find({participants:req.user.id},function(err,results){
    if (err) {
      console.log(err);
    }else{
      console.log(results);
    res.render('view_bids',{items:results,AName:req.user.username});
    }
  });
}else{
  res.redirect("/login");
}
});

//manageauctions route
app.get('/manageauctions',function(req,res){
  if(req.isAuthenticated()){
    Auction.find({startedBy:req.user.id}, function(err, result){
        if(err){
        console.log(err);
        }else{
          res.render('manage_auction', {
            items: result,AName:req.user.username
            });
         }
       });
  }else{
    res.redirect("/login");
  }
});

//individual items route
app.get("/items/:itemId", function(req,res){
  if(req.isAuthenticated()){
    var requestId=req.params.itemId;
    Auction.findOne({_id:requestId},function (err,item){
      if(err){
        console.log(err);
      }else{
          res.render("bids",{items:item});
        }
   });
 }else{
   res.redirect("/login");
 }
});

//bid update route under testing...
app.post("/placeBid/:itemId",function(req,res){
  var productId=req.params.itemId;
      Auction.updateOne({$and:[{startedBy:{$ne:req.user.id}},{_id:productId}]},{$set:{"currentBid":req.body.updatedValue,"currentBidder":req.user.username}},{upsert:true},function(err,result){
        if(err){
          console.log(err);
          req.flash("errorBid","You cannot place a Bid for your own Auction")
          res.redirect("/home");
        }else{
          req.flash("successBid","Your Bid is succesfully placed.")
          res.redirect("/home");
        }
      });
      Auction.updateOne({$and:[{startedBy:{$ne:req.user.id}},{_id:productId},{participants:{$ne:req.user.id}}]},{$push:{participants:req.user.id}},{upsert:true},function(err,result){
        if(err){
          console.log(err);
        }else{
          console.log(result);
        }
      });

});

//logout route
app.get('/logout',function(req,res){
  req.logout();
  res.redirect("/");
});

app.get('*', function(req, res){
  res.status(404).render('error404');
});

//server initilization
app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});
