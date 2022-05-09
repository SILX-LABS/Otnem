const express = require("express")
const exphbs = require("express-handlebars")
const path = require('path')
require('dotenv').config()
const router = require('./routes/posts')
const PORT = process.env.PORT
const bodyParser = require('body-parser')
const passport = require('passport')
const session = require('express-session')
const flash = require('express-flash')
const socketio = require('socket.io')
const http = require('http')
const { test, chatPage, chatRoomDB, userDB, checkIfDocExists } = require("./controllers/posts")
const { response } = require("express")
var cookie = require("cookie")
const FieldValue = require('firebase-admin').firestore.FieldValue
const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(express.static('./MentoNew'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
const sessionMiddleWare = session({
    secret: process.env.PASSPORT_SCERET,
    resave: false,
    saveUninitialized: true
})
const wrap = middleWare => (socket,next) => middleWare(socket.request,{},next)
app.use(sessionMiddleWare)
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())
app.engine('hbs', exphbs.engine({ defaultLayout: 'indexLayout', extname: '.hbs' }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.use('/',router)

io.use(wrap(sessionMiddleWare))
io.use((socket,next)=>{
    if(socket.request.session.passport)
        next()
})
io.on('connection',async socket=>{
    let userName = socket.request.session.passport.user
    await socket.join(userName)
    socket.on('joinRoom',async(user)=>{
        try{
            if(typeof user != 'string')
                return
            if(!await checkIfDocExists(userDB,user))
                return
            let roomID
            let userName = socket.request.session.passport.user
            let snap = await chatRoomDB.get()
            if(userName == user)
                return
            snap.docs.forEach(doc=>{
                let data = doc.data()
                if(data.users.includes(userName)){
                    if(data.users.includes(user))
                        roomID = doc.id
                }
            })
            if(!roomID){
                let response = await chatRoomDB.add({users:[userName,user],time:Date.parse(new Date())})
                roomID = response.id
            }
            let curRooms = []
            socket.rooms.forEach((room,i)=>{curRooms.push(room)})
            curRooms.forEach(async(e,i)=>{
                if(i >= 2)
                await socket.leave(e)
            })
            await socket.join(roomID)
            await userDB.doc(userName).collection('unRead').doc(user).set({num:0})
            const num = (await userDB.doc(user).collection('unRead').doc(userName).get()).data()
            if(!Number(num))
                await userDB.doc(user).collection('unRead').doc(userName).set({num:0})
            socket.broadcast.to(roomID).emit('wlcmMessage',`${user},${roomID}`)
        }
        catch(err){
            console.log(err)
        }
    })
    socket.on('chatMsg',async (user,msg)=>{
        let roomID
        const userName = socket.request.session.passport.user
        let snap = await chatRoomDB.get()
        if(msg == '')
            return
        if(userName == user)
            return
        snap.docs.forEach(doc=>{
            let data = doc.data()
            if(data.users.includes(userName)){
                if(data.users.includes(user))
                    roomID = doc.id
            }
        })
        let currTime = Date.parse(new Date())
        if(!roomID){
            let response = await chatRoomDB.add({users:[userName,user],time:currTime})
            roomID = response.id
        }
        await chatRoomDB.doc(roomID).collection('chats').add({user:userName,msg:msg,time:currTime})
        await userDB.doc(user).collection('unRead').doc(userName).update({num: FieldValue.increment(1)})
        await chatRoomDB.doc(roomID).set({'time':currTime},{merge:true})
        io.to(roomID).emit('message',{msg:`${msg}`,userName:userName,time:currTime})
        io.to(user).emit('notif',{msg:`${userName} sent a message`,userName:userName,time:currTime})
    })
})
server.listen(1000,()=>{
    console.log(`Listning on http://localhost:${PORT}`)
})
