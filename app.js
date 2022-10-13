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

mongoose.connect('mongodb+srv://velox:sacrificial_email3.14@cluster0.en5v2ww.mongodb.net/velox?appName=mongosh+1.4.2', {useNewUrlParser: true});


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

//API REPLACEMENT

const rawContentSchema = new mongoose.Schema({
    type: String, 
    conditional: Boolean, 
    conditionalToLangauge: String,
    rawTextContent: String
})

const contentSchema = new mongoose.Schema(
    {
        sectionTitle: String,
        sectionId: Number,
        rawContent: [rawContentSchema]
    }
)

const pageSchema = new mongoose.Schema({
    pageTitle: String,
    topic: String,
    pageId: Number,
    language: String,
    content: [
        contentSchema
    ]
});

const Page = mongoose.model("Page", pageSchema);
const User = new mongoose.model("user", userInfoSchema);

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
        Page.find({language: course.to}, (err, results) => {
            if(!err && results){
                res.render("course", {info: results, courseNum: courseNumber, courseIndex: course.index});
            }
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
        if(course.index >= page){
            Page.findOne({pageId: page, language: course.to}, (err, result) => {
                if(!err && result){
                    Page.findOne({language: course.from, topic: result.topic}, (err, result2) => {
                        if(!err && result2){
                            res.render('page', {from: result2, to: result, course: req.params.courseNumber});
                        }else if(!err){
                            res.render('page', {from: {content: []}, to: result, course: req.params.courseNumber});
                        }
                    })
                }
            })
        }else{
            res.redirect('/c/' + courseNumber);
        }
    }else{
        res.redirect('/login');
    }
});

app.post('/increment', (req, res) => {
    const proposedVal = req.body.curVal;
    const currentCourseIndex = req.body.curCourse;
    console.log(session.courses[currentCourseIndex])
    if(session.courses[currentCourseIndex].index + 1 == proposedVal){
        session.courses[currentCourseIndex].index = session.courses[currentCourseIndex].index + 1;
        User.findOne({username: session.userid}, (err, result) => {
            if(!err && result){
                result.courses[currentCourseIndex].index = session.courses[currentCourseIndex].index;
                result.save();
            }
        })
        res.redirect('/c/' + currentCourseIndex + '/' + proposedVal)
    }else if(session.courses[currentCourseIndex].index + 1 < proposedVal){
        res.redirect('/c/' + currentCourseIndex + '/' + proposedVal)
    }else{
        res.redirect('/c/' + currentCourseIndex);
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