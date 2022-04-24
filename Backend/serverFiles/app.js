const express = require("express")
const exphbs = require("express-handlebars")
const path = require('path')
const app = express()
require('dotenv').config()
const router = require('./routes/posts')
const PORT = process.env.PORT
const bodyParser = require('body-parser')
const passport = require('passport')
const session = require('express-session')

app.use(express.static('../MentoNew'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
app.use(session({
    secret: process.env.PASSPORT_SCERET,
    resave: false,
    saveUninitialized: true
}))
app.use(passport.initialize())
app.use(passport.session())
app.engine('hbs', exphbs.engine({ defaultLayout: 'indexLayout', extname: '.hbs' }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use('/',router)

app.listen(1000,()=>console.log(`Listning on ${PORT}`))