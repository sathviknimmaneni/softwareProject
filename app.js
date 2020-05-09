const express = require('express');
const bodyParser=require('body-parser');
const ejs=require('ejs');
const mongoose=require('mongoose');
const session=require('express-session');
const passport=require('passport');
const passportLocalMongo=require('passport-local-mongoose');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
  secret:"thisisourlittlesecret..",
  resave:false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

//mongoose connnection and schemas
//be sure to change Password
mongoose.connect("mongodb+srv://Sathvik:Test-123@cluster0-deldk.mongodb.net/auctionDB",{useNewUrlParser:true, useUnifiedTopology: true});
mongoose.set("useCreateIndex",true);

const auctionSchema=new mongoose.Schema({
  name:String,
  category:String,
  basePrice:Number,
  duration:Number,
  description:String,
  currentBid:Number,
  currentBidder:String
});

auctionSchema.plugin(passportLocalMongo);

const userSchema=new mongoose.Schema({
  username:String,
  password:String
});
userSchema.plugin(passportLocalMongo);

const Auction=mongoose.model("Auction",auctionSchema);
const User=mongoose.model("User",userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// starting route
app.get('/',function(req,res){
  if(req.isAuthenticated()){
    res.redirect("/home");
  }else{
    res.render("starting");
  }
});

//login route
app.get('/login',function(req,res){
    res.render('login');
});

app.post('/login',function(req,res){
  user = new User({
    username:req.body.username,
    password:req.body.password
  });

    req.login(user,function(err){
      if(err){
        console.log(err);
        res.redirect('/');
      }else{
        passport.authenticate("local")(req,res,function(){
          res.redirect('/home');
      });
    }
    })
})

//signup route
app.get('/signup',function(req,res){
  res.render('signup2');
})

app.post('/signup',function(req,res){
  User.register({username:req.body.username},req.body.password,function(err,user){
  if(err){
    console.log(err);
    res.redirect('/signup');
  }else{
    passport.authenticate("local")(req,res,function(){
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
             post: items
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

app.post('/startauction',function(req,res){
    var item={
      itemName:req.body.productName,
      itemCategory:req.body.productCategory,
      itemBasePrice:req.body.productBasePrice,
      itemDuration:req.body.productDuration,
      itemDescription:req.body.productDescription,
    }

  const newItem=new Auction({
    name:item.itemName,
    category:item.itemCategory,
    basePrice:item.itemBasePrice,
    duration:item.itemDuration,
    description:item.itemDescription,
  })

    newItem.save(function(err){
      if(!err){
        res.redirect("/home");
      }
    });
});

app.post("/bidUpdate",function(req,res){
    res.redirect("home");
});

app.get('/viewbids',function(req,res){
  res.render('view_bids');
});

app.get('/manageauctions',function(req,res){
  res.render('Manage_auctions');
})

//individual items route
app.get("/items/:itemId", function(req,res){
  if(req.isAuthenticated()){
    var requestId=req.params.itemId;
    Auction.findOne({_id:requestId},function (err,item){
      if(err){
        console.log(err);
      }else{
          res.render("bids",{Name: item.name,basePrice: item.basePrice,itemCategory:item.category,itemDescription:item.description});
        }
   });
 }else{
   res.redirect("/login");
 }
})

//logout route
app.get('/logout',function(req,res){
  req.logout();
  res.render("starting");
});

app.get('*', function(req, res){
  res.status(404).render('error404');
});

//server initilization
app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});
