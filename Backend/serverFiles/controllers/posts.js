require('dotenv').config()
const admin = require("firebase-admin")
const cloudinary = require('cloudinary').v2
const streamify = require('streamifier')
const serviceAccount = process.env.SERVICE_ACCOUNT_KEY
const webPush = require('web-push')
const passport = require('passport')
const bcrypt = require('bcrypt')

const VAPIDKEYS = webPush.generateVAPIDKeys()
webPush.setVapidDetails('mailto:pravithba10@gmail.com', process.env.PUBLIC_KEY,process.env.PRIVATE_KEY)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
})
const firebase = admin.firestore()
const userDB = firebase.collection('userData')
const {init} = require('../passportConfig')
init(passport,
    async email=>{
        let snapshot = await userDB.get()
        snapshot = snapshot.docs.map(doc => doc.data())
        return snapshot.find(user=>user.email === email)
    },
    async name=>{
        let snapshot = await userDB.get()
        snapshot = snapshot.docs.map(doc => doc.data())
        return name = snapshot.find(user=>user.name === name)
    }
)

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.API_KEY, 
    api_secret: process.env.API_SECRET
})
const mainPage = async(req,res)=>{
    let posts = await getAllPosts()
    const userObj = await getUser(req)
    posts = posts.map(post=>{
        return {...post,...userObj}
    })
    res.render('index',{posts:posts})
}
const searchPage = async(req,res)=>{
    try{
        let query = req.query
        if(!query.element && !query.element){
            return res.render('searchPosts',{success:false,msg:"Wrong query"})
        }
        userName = await getUserName(req)
        let allPosts = await getAllPosts()
        switch(query.type){
            case 'tag':
                let tagsData = allPosts.map(e => {
                    if(e.tags.includes(query.element))
                        return e
                })
                tagsData = tagsData.filter(e=>e!==undefined)
                if(!tagsData[0])
                    return res.render('searchPosts',{success:false,msg:"Tag not found"})
                return res.render('searchPosts',{success:true,data:tagsData})
            case 'title':
                if(query.element.length > 50)
                    return res.render('searchPosts',{msg:"Search element too long",success:false})
                if(query.element.length <= 0)
                    return res.render('searchPosts',{msg:"Search element empty",success:false})
                let titleData = allPosts.map(e=>{
                    if(e.title.includes(query.element))
                        return e
                })
                titleData = titleData.filter(e=>e!==undefined)
                if(!titleData[0])
                    return res.render('searchPosts',{msg:"Title not found",success:false,data:allPosts})
                return res.render('searchPosts',{success:true,data:titleData})

            default: return res.send({msg:"Search type not found"})
        }
    }
    catch(err){
        console.log(err)
    }
}
const uploadPostPage = async(req,res)=>{
    try {
        res.render('uploadPost',{layout:'indexLayout',msg:"FUCKSDS"})
    } catch (error) {
        console.log(error)
    }
}
const postComments = async(req,res)=>{
    try{
        let userName = await getUserName(req)
        let {comment,postNum,postUser} = await req.body
        if(!await checkElegible(userName,postUser))
            return res.send({success:false})
        userDB.doc(`${postUser}`).collection('posts').doc(postNum).collection('comments').doc().set({user:userName,content:comment},{merge:true})
        res.send({success:true,postNum:postNum})
    }
    catch(err){
        console.log(err)
    }
}
const deleteComment = async (req,res)=>{
    try{
        const userName = await getUserName(req)
        if(!await checkElegible(userName,userName))
            return res.send({success:false})
        const{commentNum,postNum,postUser} = await req.body
        await userDB.doc(postUser).collection('posts').doc(postNum).collection('comments').doc(commentNum).delete()
        res.end()
    }
    catch(err){
        console.log(err)
    }
}
const uploadFile = async(req,res)=>{
    try {
        let userName = await getUserName(req)
        let {title,disc,tags} = await req.body
        if(title.length > 50 && disc.length > 550 && tags.length >= 50){
            return res.json({msg:"Too long FFFFF",status:400})}
            let buffer = await req.file.buffer
            let cldUploadStream = cloudinary.uploader.upload_stream({
                folder:`${userName}/posts/`,
                height: 500, width: 500, crop: "scale",
            },async(err,response)=>{
                let imageName = (response.public_id.split('/'))[((response.public_id.split('/'))).length-1]
                if (err) return res.send(err)
                let imgURL = response.secure_url
                await userDB.doc(`${userName}`).set({exists:true},{merge:true})
                await userDB.doc(`${userName}`).collection(`posts`).doc(imageName).set({
                    title:title,
                    disc:disc,
                    public_id:response.public_id,
                    img:imgURL,
                    tags:tags.split(' ').filter(Boolean)
                },{merge:true})
                let followersSnap = await userDB.doc(userName).collection('followers').get()
                let followers = followersSnap.docs.map(doc=>{
                    return doc.id
                })
                console.log(followers)
                followers.forEach(async follower=>{
                    await notify(follower,`${userName} uploaded a post`,`Check out ${userName}'s post`)
                })
                res.send({num:imageName,user:userName})
        })
        streamify.createReadStream(buffer).pipe(cldUploadStream)
    } catch (error) {
        console.log(error)
    }
}
const postPreviewPage = async(req,res)=>{
    try {
        let userName = await getUserName(req)
        let query = await req.query
        if(!query.user || !query.postNum)
            return res.send("No Post Found")
        let isComment = false
        let commentsArray = []
        if(checkElegible(userName,query.user)){
            let postData = (await userDB.doc(query.user).collection('posts').doc(query.postNum).get()).data()
            let commentSnapshot = await userDB.doc(query.user).collection('posts').doc(query.postNum).collection('comments').get()
            if(!commentSnapshot.empty){
                isComment = true
                commentsArray = commentSnapshot.docs.map(doc=>{
                    let data = doc.data()
                    data['commentNum'] = doc.id
                    return data
                })
            }
            let err = false
            if(postData == undefined){
                postData = {}
                postData['img'] = "https://www.publicdomainpictures.net/pictures/280000/nahled/not-found-image-15383864787lu.jpg"
                postData['title'] = "ERRRRR"
                postData['disc'] = "ERRRRRR"
                err = true
            }
            res.render('postPreview',{layout:'indexLayout',postUser:query.user,commentsArray:commentsArray,isComment:isComment,tags:postData.tags,imgURL:postData.img,title:postData.title,disc:postData.disc,err:err,postNum:query.postNum})
        }
        else{
            res.send("ERROR")
        }
    } catch (error) {
        console.log(error)
    }
}
const followUser = async(req,res)=>{
    try{
        const {followUserName} = await req.body
        if(!await checkIfUserExists(followUserName))
            return res.send("User doesnt exists")
        let userName = await getUserName(req)
        await userDB.doc(followUserName).collection('followers').doc(userName).set({exists:true})
        await userDB.doc(userName).collection('following').doc(followUserName).set({exists:true})
        res.send({msg:"Followed"})
    }
    catch(err){
        console.log(err)
    }
}
const unfollowUser = async(req,res)=>{
    try{
        const {unFollowUserName} = await req.body
        if(!await checkIfUserExists(unFollowUserName))
        return res.send("User doesnt exists")
        let userName = await getUserName(req)
        await userDB.doc(unFollowUserName).collection('followers').doc(userName).delete()
        await userDB.doc(userName).collection('following').doc(unFollowUserName).delete()
        res.send({msg:"unFollowed"})
    }
    catch(err){
        console.log(err)
    }
}
const assignNotif = async (req,res)=>{
    try {
        const userName = await getUserName(req)
        const {push} = await req.body
        await userDB.doc(userName).set({push:push},{merge:true})
    } 
    catch(err){
        console.log(err)
    }
}
const registerPost= async(req,res)=>{
    try{
        const body = await req.body
        const userSnapshot = await userDB.get()
        let users = userSnapshot.docs.map(doc=>{
            if(doc.data().name)
                return doc.data()
        })
        users = users.filter(e=>e!==undefined)
        for(i=0;i<users.length;i++){
            if(users[i].name == body.name)
                return res.send("NAME ALR EXISTS")
            if(users[i].email == body.email)
                return res.send("EMAIL ALR EXISTS")
        }
        const hashedPasswrod = await bcrypt.hash(body.password,10)
        let userInfoObj = {
            name:body.name,
            email:body.email,
            password:hashedPasswrod,
            image:'https://media.istockphoto.com/vectors/anonymity-concept-icon-in-neon-line-style-vector-id1259924572?k=20&m=1259924572&s=612x612&w=0&h=Xeii8p8hOLrH84PO4LJgse5VT7YSdkQY_LeZOjy-QD4='
        }
        await userDB.doc(body.name).set(userInfoObj,{merge:true})
        res.send("Registered")
    }
    catch(err){
        console.log(err)
    }
}
const logout = async(req,res)=>{
    req.logout()
}
const changeCredentials = async(req,res)=>{
    try{
        let userName = await getUserName(req)
        let {cred,newElement} = await req.body
        switch(cred){
            case 'password':
                let {currentElement} = await req.body
                let currentPassword = (await userDB.doc(userName).get()).data()
                currentPassword = currentPassword.password
                console.log(newElement)
                bcrypt.compare(currentElement,currentPassword,async function(err,response){
                    if(response){
                        let newHashedPassword = await bcrypt.hash(newElement,10)
                        await userDB.doc(userName).set({password:newHashedPassword},{merge:true})
                        return res.send("Changed")
                    }
                    else{
                        return await res.send("Passwords didnt match")
                    }
                })
            case 'profilePic':
                await userDB.doc(userName).set({image:newElement},{merge:true})
                return res.send("Changed")
            }
    }
    catch(err){
        console.log(err)
    }
}
const test = async (req,res)=>{
    let userName = await getUserName(req)
    console.log(userName)
    res.send(userName)
}

// CUSTOM FUNCTIONS
async function notify(userName,title,disc){
    try{
        let push = (await userDB.doc(userName).get()).data()
        push = push.push
        if(!push)
            return "User Doesnt have push"
        let pushSubscription = push
        if(typeof push == 'string')
            pushSubscription = JSON.parse(push)
        let payloadObj = {title:title,disc:disc}
        await userDB.doc(userName).collection('notifications').doc().set({title:payloadObj.title,disc:payloadObj.disc},{merge:true})
        await webPush.sendNotification(pushSubscription,JSON.stringify(payloadObj))
        return "Done"
    }
    catch(err){
        console.log(err)
    }
}
async function checkIfUserExists(user){
    let snapshot = await userDB.get()
    let res = false
    snapshot.forEach(doc=>{
        if(user == doc.id)
            res = true
    })
    return res
}
async function checkElegible(user,checkUser){
    if(checkUser == user)return true
    let visibality = (await userDB.doc(user).get()).data
    visibality = visibality.visibality || "public"
    if(visibality == "public")return true
    let snapshot = await userDB.doc(user).collection('followers').get()
    let res = false
    snapshot.docs.map(doc=>{
        return doc
    })
    return res
}
async function getUserName(req){
    let userInfo = await req.user
    let userName
    (userInfo)?userName=userInfo.name:userName='test1'
    return userName
}
async function getUser(req,showPassword){
    try{
        let userInfo = await req.user
        let userName
        (userInfo)?userName=userInfo.name:userName='Fuck user'
        const {email,name,image,password} =(await userDB.doc(userName).get()).data()
        let userObject = {
            "userName":name,
            "userEmail":email,
            "profilePic":image
        }
        if(showPassword)
            userObject["password"] = password
        return userObject
    }
    catch(err){
        console.log(err)
    }
}
async function getAllPosts(){
    let userSnapshot = await userDB.get()
    let posts = []
    let allUsers = userSnapshot.docs.map(doc=>{return doc.id})
    for(let user of allUsers){
        let snapshot = await userDB.doc(user).collection('posts').get()
        let post = snapshot.docs.map(doc=>{
            let data = doc.data()
            data['user'] = user
            data['postName'] = doc.id
            return data
        })
        posts.push(...post)
    }
    return posts
}
module.exports = {admin,uploadPostPage,uploadFile,postPreviewPage,postComments,deleteComment,searchPage,followUser,assignNotif,test,assignNotif,unfollowUser,registerPost,logout,changeCredentials,mainPage}