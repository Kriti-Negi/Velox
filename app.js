const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");

const axios = require('axios').default;

const cookieParser = require("cookie-parser");
const sessions = require('express-session');

const bcrypt = require("bcryptjs");
const saltRounds = 10;

const mongoose = require("mongoose");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public/'));
app.use(cookieParser());

let session;

mongoose.connect('mongodb://localhost:27017/UserProfiles', {useNewUrlParser: true});

const userInfoSchema = new mongoose.Schema({
    username: String,
    password: String, 
    courses: [
        {
            from: String, //langauge
            to: String,
            index: Number,
            courseId: Number
        }
    ]
});

const User = new mongoose.model("User", userInfoSchema);

// creating 24 hours from milliseconds
const oneDay = 1000 * 60 * 60 * 24;

//session middleware
app.use(sessions({
    secret: "heyKids",
    saveUninitialized:true,
    cookie: { maxAge: oneDay },
    resave: false
}));

app.get("/", (req, res) => {
    if(session){
        res.render('home', {courses: session.courses});
    }else{
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.render("login");
});

app.get('/signup', (req, res) => {
    res.render("signup");
});

app.get('/newCourse', (req, res) => {
    if(session){
        res.render("newCourse");
    }else{
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) =>{
    req.session.destroy()
    req.session = null;
    session = null;
    res.redirect('/');

})

app.get('/c/:courseNumber', (req, res) => {
    if(session){
        const courseNumber = req.params.courseNumber;
        const course = session.courses[courseNumber];
        axios.get('https://blooming-eyrie-71183.herokuapp.com/imgSrCde/pages/' + course.to)
            .then(function (response) {
                res.render("course", {info: response.data, courseNum: courseNumber});
            }).catch(function (error) {
                console.log(error);
            })
        
    }else{
        res.redirect('/login');
    }
});

app.get('/c/:courseNumber/:pageNum', (req, res) => {
    if(session){
        const courseNumber = req.params.courseNumber;
        const course = session.courses[courseNumber];
        const page = req.params.pageNum;

        let from;
        let to;

        axios.get('https://blooming-eyrie-71183.herokuapp.com/imgSrCde/pages/' + course.to + "/" + page)
            .then(function (response) {
                to = response.data;
            }).catch(function (error) {
                console.log(error);
            }).then(() => {
                axios.get('https://blooming-eyrie-71183.herokuapp.com/imgSrCde/pages/' + course.from + "/" + page)
                .then(function (response) {
                    from = response.data;
                }).catch(function (error) {
                    console.log(error);
                }).then(() => {
                    console.log(from);
                    console.log(to);
                    res.render('page', {from: from, to: to, course: req.params.courseNumber});

                })
            })

    }else{
        res.redirect('/login');
    }
});

app.post('/login', (req, res) => {
    const username = req.body.email;
    const password = req.body.password;
    User.findOne({'username': username}, (err, results) => {
        if(results && !err){
            if(bcrypt.compareSync(password, results.password)){
                session=req.session;
                session.courses = results.courses;  
                session.userid = results.username;         
                res.redirect('/')
            }else{
                res.redirect('/signUp');
            }
        }else{
            res.redirect('/signUp');
        }
    });
})

app.post("/signUp", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    User.findOne({username: email}, (err, results) => {
        if(results && !err){
            res.redirect('/signUp');

        }else if(err){
            res.redirect('/signUp');
        }else{
            bcrypt.hash(password, saltRounds, (err, hash) => {
                if(err){
                    console.log(err);
                    res.redirect('/signUp');
                }else if(hash && !err){
                    const u = new User({
                        username: email,
                        password: hash,
                        courses: []
                    });
                    u.save();
                    session=req.session;    
                    session.courses = u.courses;  
                    session.userid = u.username;
                    res.redirect('/')              
                }else{
                    res.redirect('/signUp');
                }
            })
        }
    })
});

app.post('/newCourse', (req, res) => {
    const FROM = req.body.from;
    const TO = req.body.to; 
    if(session){

        if(FROM == TO){
            res.redirect('/newCourse');
        }else{
            User.findOne({username: session.userid}, (err, results) => {
                if(err){
                    res.redirect('/newCourse');
                }else if(results && !err){
                    results.courses.push({from: FROM, to: TO, index: 0, courseId: results.courses.length})
                    session.courses = results.courses;
                    results.save();
                    res.redirect('/newCourse');
                }else{
                    res.redirect('/newCourse');
                }
            })
        }
    }
})

app.listen(3000);