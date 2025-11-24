const express = require('express')
const app = express()
const path = require('path')

const posts = require('./models/posts.js')
const userModel = require('./models/users.js')

const sessions = require('express-session')
const cookieParser = require('cookie-parser')

const threeMinutes = 3 * 60 * 1000

// EJS setup
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))


app.use(
    sessions({
        secret: "my own secret phrase",
        cookie: { maxAge: threeMinutes },
        resave: false,
        saveUninitialized: false
    })
)

app.use(express.static('public'))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())


const dotenv = require('dotenv').config()
const mongoose = require('mongoose')

const mongoDBPassword = process.env.MONGODB_PASSWORD
const mongoDBUser = process.env.MONGODB_USERNAME
const mongoDBAppName = process.env.MONGODB_MYAPPNAME

const connectionString = `mongodb+srv://${mongoDBUser}:${mongoDBPassword}@cluster0.lpfnqqx.mongodb.net/${mongoDBAppName}?retryWrites=true&w=majority`

mongoose.connect(connectionString)
    .then(() => console.log(" Connected to MongoDB:", mongoose.connection.name))
    .catch(err => console.log(" MongoDB connection error:", err))


function checkLoggedIn(req, res, next) {
    if (req.session?.username) {
        next()
    } else {
        res.render('notloggedin')
    }
}

function checkAdmin(req, res, next) {
    if (!req.session?.username) {
        return res.redirect('/login')
    }
    if (req.session.isAdmin !== true) {
        return res.status(403).render('notallowed')
    }
    next()
}


// ✅ ROUTES

app.get('/', (req, res) => {
    res.render('login')
})

app.get('/app', checkLoggedIn, (req, res) => {
    res.render('app', { username: req.session.username })
})

// ✅ POSTS API
app.get('/getposts', async (req, res) => {
    res.json({ posts: await posts.getLastNPosts() })
})

app.post('/newpost', checkLoggedIn, async (req, res) => {
    await posts.addPost(req.body.message, req.session.username)
    res.redirect('/app')
})

// PROFILE
app.get('/profile', checkLoggedIn, async (req, res) => {
    const user = await userModel.getUser(req.session.username)
    res.render('profile', { user })
})

app.post('/profile', checkLoggedIn, async (req, res) => {
    await userModel.updateName(
        req.session.username,
        req.body.firstname,
        req.body.lastname
    )
    res.redirect('/profile')
})

//  LOGIN
app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/login', async (req, res) => {
    const valid = await userModel.checkUser(req.body.username, req.body.password)

    if (valid) {
        const user = await userModel.getUser(req.body.username)
        req.session.username = user.username
        req.session.isAdmin = user.isAdmin
        res.redirect('/app')
    } else {
        res.render('login_failed')
    }
})

// register
app.get('/register', (req, res) => {
    res.render('register')
})

app.post('/register', async (req, res) => {
    const { username, password, firstname, lastname, adminCode } = req.body

    const isAdmin = adminCode === process.env.ADMIN_SECRET

    if (await userModel.addUser(username, password, firstname, lastname, isAdmin)) {
        res.render('login')
    } else {
        res.render('registration_failed')
    }
})

// login page 
app.get('/admin-login', (req, res) => {
    res.render('admin_login')
})

//admin handler
app.post('/admin-login', async (req, res) => {
    const user = await userModel.getUser(req.body.username)

    if (!user) return res.render('notallowed')

    const isValid = await userModel.checkUser(req.body.username, req.body.password)

    if (isValid && user.isAdmin) {
        req.session.username = user.username
        req.session.isAdmin = true
        return res.redirect('/admin')
    }

    res.render('notallowed')
})


app.get('/admin', checkAdmin, async (req, res) => {
    const users = await userModel.getAllUsers()
    const allPosts = await posts.getAllPosts()

    res.render('admin', {
        users: users.map(u => ({
            _id: u._id,
            username: u.username,
            firstname: u.firstname,
            lastname: u.lastname
        })),
        posts: allPosts
    })
})

app.post('/admin/deleteuser/:id', checkAdmin, async (req, res) => {
    await userModel.deleteUser(req.params.id)
    res.redirect('/admin')
})

app.post('/admin/deletepost/:id', checkAdmin, async (req, res) => {
    await posts.deletePost(req.params.id)
    res.redirect('/admin')
})


app.get('/logout', checkLoggedIn, (req, res) => {
    res.render('logout')
})

app.post('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/login')
})




app.listen(3000, () => {
    console.log('✅ listening on port 3000')
})
