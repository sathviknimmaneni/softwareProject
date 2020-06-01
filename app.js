require('dotenv').config()
const express = require('express');
const bodyParser=require('body-parser');
const ejs=require('ejs');
const mongoose=require('mongoose');
const session=require('express-session');
const MongoStore = require('connect-mongo')(session);
var cookieParser = require('cookie-parser');
const passport=require('passport');
const passportLocalMongo=require('passport-local-mongoose');
const flash = require('connect-flash');
const moment=require("moment");
const socket=require("socket.io");
const passportSocketIo = require("passport.socketio");
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid=require("gridfs-stream");
const path=require("path");
const crypto=require("crypto");
const $=require("jquery");

const app = express();

app.set('view engine', 'ejs');

//mongoose connnection and schemas
mongoose.connect("mongodb+srv://Sathvik:"+process.env.DBKEY+"@cluster0-deldk.mongodb.net/auctionDB",{useNewUrlParser:true, useUnifiedTopology: true});
//mongoose.connect("mongodb://localhost:27017/auctionDB",{useNewUrlParser:true, useUnifiedTopology: true});
const conn=mongoose.createConnection("mongodb+srv://Sathvik:"+process.env.DBKEY+"@cluster0-deldk.mongodb.net/auctionDB",{useNewUrlParser:true, useUnifiedTopology: true});


//config middlewares and others..
mongoose.set("useCreateIndex",true);

app.use(bodyParser.urlencoded({extended: true}));
 app.use(express.static("public"));
 app.use(cookieParser('secret'));
 app.use(session({
   key:'express.sid',
   secret:process.env.SECRET,
   store: new MongoStore({mongooseConnection:mongoose.connection}),
   resave:false,
   saveUninitialized: false,
 }));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

//mongo Schema for new Auction
const auctionSchema=new mongoose.Schema({
  startedBy:String,
  name:String,
  category:String,
  basePrice:Number,
  duration:Number,
  description:String,
  startedOn:Date,
  endOn:Date,
  currentBid:Number,
  currentBidder:{name:String,contact:String},
  status:{type:String,default:"Ongoing"},
  participants:[{
    type:mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse:true
  }],
  image:String
});
auctionSchema.plugin(passportLocalMongo, { usernameUnique: false});

//mongo schema for New User
const userSchema=new mongoose.Schema({
  username:String,
  email:String,
  password:String,
  role:{type:String,default:"user"},
  flag:{type:Boolean,default:true}
});
userSchema.plugin(passportLocalMongo,{usernameUnique:true,usernameField: "email",passwordField:"password",findByUsername: function(model, queryParameters) {
    // Add additional query parameter - AND condition - active: true block or unblock an User with flag.
    queryParameters.flag = true;
    return model.findOne(queryParameters);
  }});

//mongo new message schema
const messageSchema=new mongoose.Schema({
    username:String,
    message:String,
});
messageSchema.plugin(passportLocalMongo,{usernameUnique:false});

const Auction=mongoose.model("Auction",auctionSchema);
const User=mongoose.model("User",userSchema);
const Message=mongoose.model("Message",messageSchema);

//passport authentication stuff
passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//check role of a user (middle ware)
const isAdmin = function (req, res, next) {
   if (req.user.role == "Admin"){
     return next ();
   }else{
     res.redirect("error404");
   }
}

//girdfs and multer configuration
let gfs;

conn.once("open",function(){
  gfs=Grid(conn.db,mongoose.mongo);
  gfs.collection("uploads");
})

//storage engine..
var storage = new GridFsStorage({
  url: "mongodb+srv://Sathvik:"+process.env.DBKEY+"@cluster0-deldk.mongodb.net/auctionDB",
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const fileName = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: fileName,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });


//api for getting image
app.get("/image/:filename",function(req,res){
gfs.files.findOne({filename:req.params.filename},function(err,file){

  if(!file || file.length === 0){
    return res.status(404).json({
      err:"No files"
    });
    }

    if(file.contentType === "image/jpeg" || file.contentType === "image/png"){
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    }else{
      return res.status(404).json({
        err:'not an image'
      });
    }

})
});


// starting route
app.get('/',function(req,res){
  if(req.isAuthenticated()){
      req.flash("Welcome","welcome back,")
      res.redirect("/home");
  }else{
    res.render('starting');
  }
});

//login route
app.get('/login',function(req,res){
  if(req.isAuthenticated()){
      res.redirect("/home");
  }else{
    res.render('login',{loginError:req.flash("userNotFound")});
  }
});


app.post('/login',passport.authenticate('local', { successRedirect: '/home', failureRedirect: '/login',failureflash:{"userNotFound":"Invalid Username or Password!"}}));


//signup route
app.get('/signup',function(req,res){
  if(req.isAuthenticated()){
    res.redirect("/home");
  }else{
    res.render('signup',{errorM:req.flash("userExists")});
  }
});
app.post('/signup',function(req,res){
  User.register({email:req.body.email,username:req.body.username},req.body.password,function(err,user){
  if(err){
    req.flash("userExists","Sorry a User already exists with the given Mail Id.");
    res.redirect('/signup');
  }else{
    passport.authenticate("local")(req,res,function(){
      req.flash("successSignUp","Your account has been succesfully created..")
      res.redirect('/home');
    });
  }
  });
})

//home route
app.get('/home',function(req,res){
  if(req.isAuthenticated()){

  Auction.find({status:{$ne:"FINISHED"}}, function(err, items){
      if(err){
      console.log(err);
      }else{
            res.render("home", {
              post: items,
              AName:items.startedBy,
              welcomeMessage:req.flash("Welcome"),
              startedAuction:req.flash("auctionStarted"),
              signedUp:req.flash("successSignUp")
              });
          }
        });
}
else{
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

app.post("/startauction",upload.single("uploadedImage"), function(req,res){
  if(req.isAuthenticated()){
  const newItem=new Auction({
    startedBy:req.user.id,
    name:req.body.itemName,
    category:req.body.itemCategory,
    basePrice:req.body.basePrice,
    currentBid:req.body.basePrice,
    duration:req.body.itemDuration,
    description:req.body.itemDescription,
    startedOn:moment().format("YYYY-MM-DD HH:mm:ss"),
    endOn:moment().add(req.body.itemDuration,"hours").format("YYYY-MM-DD HH:mm:ss"),
    image:req.file.filename
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
if(req.isAuthenticated()){
    res.render("bidUpdate");
}else{
  res.redirect("/");
}
});


//view your intrest route.
app.get('/viewbids',function(req,res){
  if(req.isAuthenticated()){
  Auction.find({participants:req.user.id},function(err,results){
    if (err) {
      console.log(err);
    }else{
        res.render('view_bids',{items:results,currentUser:req.user.email});
    }
  });
}else{
  res.redirect("/login");
}
});

//manageauctions route
app.get('/manageauctions',function(req,res){
  if(req.isAuthenticated()){
    Auction.find({startedBy:req.user.id}, function(err, results){
        if(err){
        console.log(err);
        }else{
          res.render('manage_auction', {
            items: results,
            AName:req.user.username
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
          User.findOne({_id:item.startedBy},function(err,foundUser){
            if(err){
              console.log(err);
            }else{
            res.render("bids",{
              items:item,
              SName:foundUser.username,
              CDetails:foundUser.email,
              unableBid:req.flash("errorBid"),
              placedBid:req.flash("successBid"),
              tryAgain:req.flash("insufficient")
              },
            );
            }
          });
        }
   });
 }else{
   res.redirect("/login");
 }
});

//gets request from AJAX when an Auction has been FINISHED.
app.post("/statusUpdate/:itemId",function(req,res){
  var itemId=req.params.itemId;

  Auction.updateOne({_id:itemId},{$set:{"status":"FINISHED"}},function(err,result){
    if(err){
      console.log(err);
    }else{
      res.redirect("/items/"+itemId);
    }
  });
});


//bid update route...
app.post("/placeBid/:itemId",function(req,res){
  var productId=req.params.itemId;
  Auction.findOne({_id:productId},function(err,response){
    if(err){
      console.log(err);
    }else{
      if(req.body.updatedValue > response.currentBid){
        Auction.updateOne({$and:[{startedBy:{$ne:req.user.id}},{_id:productId}]},{$set:{"currentBid":req.body.updatedValue,"currentBidder.name":req.user.username,"currentBidder.contact":req.user.email}},{upsert:true},function(err,result){
          if(err){
            console.log(err);
            req.flash("errorBid","You cannot place a Bid for your own Auction")
            res.redirect("/items/"+productId);
          }else{
            req.flash("successBid","Your Bid is succesfully placed.")
            res.redirect("/items/"+productId);
          }
        });
        Auction.updateOne({$and:[{startedBy:{$ne:req.user.id}},{_id:productId},{participants:{$ne:req.user.id}}]},{$push:{participants:req.user.id}},{upsert:true},function(err,result){
          if(err){
            console.log(err);
          }
        });
      }else{
        req.flash("insufficient","Your Bid amount was not sufficient")
        res.redirect("/items/"+productId);
      }
    }
  });
});



//admin route
app.get("/admin",isAdmin,function(req,res){
  if(req.isAuthenticated()){
    Auction.find({},function(err,results){
      if(err){
        console.log(err);
      }else{
        User.find({},function(err,users){
          if (err) {
            console.log(err);
          }else{
            res.render("adminView",{
              auctions:results,
              AName:results.startedBy,
              Users:users,
              });
          }
        });
      }
    });
  }else{
    res.redirect("/login");
  }
});

//updating an Items details by Admin
app.get("/adminupdate/:itemId",isAdmin,function(req,res){
if(req.isAuthenticated()){
  var productId=req.params.itemId;
  Auction.findOne({_id:productId},function(err,foundItem){
    if(err){
      console.log(err);
    }else{
      res.render("adminUpdate",{Item:foundItem});
    }
  })
}else{
  res.redirect("/login");
}
});

app.post("/adminupdate/:itemId",function(req,res){
  var productId=req.params.itemId;
  Auction.updateOne({$and:[{_id:productId},{status:{$ne:"FINISHED"}}]},{$set:{
    "name":req.body.itemName,
    "category":req.body.itemCategory,
    "duration":req.body.itemDuration,
    "description":req.body.itemDescription,
    "startedOn":moment().format("ddd MMM DD YYYY hh:mm:ss"),
    "endOn":moment().add(req.body.itemDuration,"hours").format("ddd MMM DD YYYY hh:mm:ss")
  }
},function(err,result){
  if(err){
    console.log(err);
  }else{
    res.redirect("/admin");
  }
});
});

//update user flag from Admin access..
app.post("/users/:userId/:Uflag",function(req,res){
  var UId=req.params.userId;
  var UFlag=req.params.Uflag;
  if(UFlag == "true"){
    User.updateOne({_id:UId},{$set:{"flag":false}},function(err,result){
      if(err){
        console.log(err);
      }else{
        res.redirect("/admin");
      }
    });
}
    else{
    User.updateOne({_id:UId},{$set:{"flag":true}},function(err,result){
      if(err){
        console.log(err);
      }else{
        res.redirect("/admin");
      }
    });
  }
});

//server initilization
var server = app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});

//chatroom route..
app.get("/chatroom",function(req,res){
  if(req.isAuthenticated()){
    //----- Chatroom details and stuff ----------

      // Socket setup & pass server
      const io = socket(server);
      io.use(passportSocketIo.authorize({
        key:          'express.sid',       //make sure is the same as in your session settings in app.js
        secret:       process.env.SECRET,      //make sure is the same as in your session settings in app.js
      store: new MongoStore({mongooseConnection:mongoose.connection}),
      }));

      io.on('connection', (socket) => {

          // Handle chat event gets from chat.js
          socket.on('chat', function(data){
               const newMessage = new Message({username:data.handle,message:data.message});
               newMessage.save(function(err){
                 if(err){
                   console.log(err);
                 }
               });
              io.sockets.emit('chat', data);
          });

          // Handle typing event
          socket.on('typing', function(data){
              socket.broadcast.emit('typing', data);
          });
      });

      Message.find({},function(err,results){
        if(err){
          console.log(err);
        }else{
          res.render("chatroom",{messages:results,handle:req.user.username});
        }
      });
  }else{
    res.redirect("/");
  }
});
//-------- chatroom end -------

//api for AJAX request used in Bids view
app.get("/getCurrentBidder/:itemId",function(req,res){
if(req.isAuthenticated()){
    var itemId=req.params.itemId;
    Auction.findOne({_id:itemId},function(err,result){
      if(err){
        console.log(err);
      }else{
        res.send(result.currentBidder.name);
      }
    });
}else{
  res.redirect("/home");
}
});

app.get("/getCurrentBidValue/:itemId",function(req,res){
  if(req.isAuthenticated()){
    var itemId=req.params.itemId;
    Auction.findOne({_id:itemId},function(err,result){
      if(err){
        console.log(err);
      }else{
        res.send(result.currentBid.toString());
      }
    });
  }else{
    res.redirect("/home");
  }
});

app.get("/about",function(req,res){
  if(req.isAuthenticated()){
    res.render("about");
  }else{
    res.redirect("/");
  }
});

//logout route
app.get('/logout',function(req,res){
  req.logout();
  res.redirect("/");
});

//404 error view
app.get('*', function(req, res){
  res.status(404).render('error404');
});
