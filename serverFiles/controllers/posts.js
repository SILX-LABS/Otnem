require('dotenv').config()
const admin = require("firebase-admin")
const cloudinary = require('cloudinary').v2
const streamify = require('streamifier')
const serviceAccount = process.env.SERVICE_ACCOUNT_KEY
const webPush = require('web-push')
const passport = require('passport')
const bcrypt = require('bcrypt')
const emailer = require('nodemailer')
const emailCheck = require('email-existence')
const validator = require('@digitalroute/email-verify')

webPush.setVapidDetails('mailto:pravithba10@gmail.com', process.env.PUBLIC_KEY,process.env.PRIVATE_KEY)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
})
const firebase = admin.firestore()
const userDB = firebase.collection('userData')
const unVerifiedDB = firebase.collection('unVerified')
const chatRoomDB = firebase.collection('chatRoom')
const {init} = require('../passportConfig')
const { response } = require('express')
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
    try{
        const {attr,element} = await req.query
        let userName = await getUserName(req)
        let loggedIn = false
        let userObj = {profilePic:""}
        if(userName){
        userObj = await getUser(userName)
        loggedIn = true
        }
        let finalArray = await getAllPostsFiltered(attr,element)
        let isPost = false
        if(finalArray[0])
            isPost = true
        finalArray.forEach(post=>{(post['likesArray'].includes(userName))?post['isLiked']=true:post['isLiked']=false})
        res.render('index',{isPost:isPost,len:finalArray.length,posts:finalArray,loggedIn:loggedIn,profilePic:userObj.profilePic,isAuth:req.isAuthenticated()})
    }catch(err){
        console.log(err)
    }
}
const login = async(req,res)=>{
    res.render('login',{layout:'loginLayout'})
}
const register = async(req,res)=>{
    res.render('login',{layout:'registerLayout'})
}
const profile = async(req,res)=>{
    try{
        let userName = await getUserName(req)
        let query = await req.query
        if(query.user && !await checkIfUserExists(query.user))
            return res.redirect('/')
        if(!query.user && !userName)
            return res.redirect('login')
        if(query.user)
            userName = query.user
        let userObj = await getUser(userName)
        let isFollowing = false
        if(req.isAuthenticated() && query.user && await checkIfFollowing(await getUserName(req),query.user)){
            isFollowing = true
        }
        userObj['isFollowing'] = isFollowing
        let snapshot = await userDB.doc(userName).collection('followers').get()
        let followers = snapshot.docs.map(doc=>{
        return doc
        })
        snapshot = await userDB.doc(userName).collection('following').get()
        let following = snapshot.docs.map(doc=>{
        return doc
        })
        userObj['followers'] = followers.length
        userObj['following'] = following.length
        let posts = await getAllUserPosts(userName)
        let myName = await getUserName(req)
        posts.forEach(post=>{
        post['name'] = userName
        post['profilePic'] = userObj.profilePic
        post['verified'] = userObj.verified
        post['isLiked']=false
        if(post['likesArray'].includes(myName))post['isLiked']=true
        })
        userObj['posts'] = posts
        let isPost = false
        if(posts[0])
            isPost = true
        userObj['isPost'] = isPost
        userObj['isAuth'] = req.isAuthenticated()
        userObj['isMine'] = (await getUserName(req) == query.user || !query.user)?true:false
        if(!await getUserName(req))userObj['isMine'] = false
        let userPfp = ''
        if(req.isAuthenticated())
            userPfp = (await getUser(await getUserName(req))).profilePic
        res.render('profile',{layout:'profileLayout',userObj:userObj,profilePic:userPfp,isAuth:req.isAuthenticated()})
    }catch(err){
        console.log(err)
    }
}
const settings = async(req,res)=>{
    let userData = await getUser(await getUserName(req))
    res.render('settings',{userName:userData.userName,profilePic:userData.profilePic,userData:userData})
}
const notifPage = async(req,res)=>{
    let userName = await getUserName(req)
    let user = await getUser(userName)
    let snapshot = await userDB.doc(userName).collection('notifications').get()
    let notifications = snapshot.docs.map(doc=>{
        let data = doc.data()
        data['id'] = doc.id
        return data
    })
    res.render('notifications',{notifications:notifications,profilePic:user.profilePic})

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
                return res.render('searchPosts',{success:true,data:tagsData,isAuth:req.isAuthenticated()})
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
                return res.render('searchPosts',{success:true,data:titleData,isAuth:req.isAuthenticated()})

            default: return res.send({msg:"Search type not found"})
        }
    }
    catch(err){
        console.log(err)
    }
}
const uploadPostPage = async(req,res)=>{
    try {
        const {profilePic} = await getUser(await getUserName(req))
        res.render('uploadPage',{layout:'indexLayout',msg:"FUCKSDS",profilePic:profilePic,isAuth:req.isAuthenticated()})
    } catch (error) {
        console.log(error)
    }
}
const chatPage = async(req,res,next)=>{
    try{        
        const {user} = await req.query
        let userName = await getUserName(req)
        console.log()
        if(!userName)
            return res.redirect('login')
        if(!await checkIfDocExists(userDB,user))
            return res.send("User Doesnt exist")
        const user1 = await getUser(userName)
        const user2 = await getUser(user)
        return res.render('chatRoom',{userName:userName,profilePic:user1.profilePic,user:user,profilePic2:user2.profilePic})
    }
    catch(err){
        console.log(err)
    }
}
const checkIfUserExistsRoute = async(req,res)=>{
    const {user} = await req.query
    return res.send(await checkIfUserExists(user))
}
const deletePost = async(req,res)=>{
    try{
        const {postNum} = await req.body
        let userName = await getUserName(req)
        let postData = (await userDB.doc(userName).collection('posts').doc(postNum).get()).data()
        if(!postData)
            return res.send('Post not found')
        let {public_id} = postData
        await userDB.doc(userName).collection('posts').doc(postNum).delete()
        cloudinary.uploader.destroy(public_id)
    }catch(err){
        console.log(err)
    }
}
const postComments = async(req,res)=>{
    try{
        let userName = await getUserName(req)
        if(!userName)
            return res.send("notAuth")
        let {comment,postNum,postUser} = await req.body
        let userCheck = (await userDB.doc(postUser).get()).data()
        if(!userCheck)
            return res.send({success:false})
        let postCheck = (await userDB.doc(postUser).collection('posts').doc(postNum).get()).data()
        if(!postCheck)
            return res.send({success:false})
        if(!comment || !postNum || !postUser)
            return res.send({success:false})
        if(!await checkElegible(userName,postUser))
            return res.send({success:false})
        userDB.doc(`${postUser}`).collection('posts').doc(postNum).collection('comments').doc().set({user:userName,content:comment},{merge:true})
        res.send(postNum)
    }
    catch(err){
        console.log(err)
    }
}
const deleteComment = async (req,res)=>{
    try{
        const userName = await getUserName(req)
        const{commentNum,postNum,postUser,commentUser} = await req.body
        if(userName != commentUser)
            return res.send({status:400,success:false})
        let result = await userDB.doc(postUser).collection('posts').doc(postNum).collection('comments').doc(commentNum).delete()
        res.send(result)
    }
    catch(err){
        console.log(err)
    }
}
const uploadFile = async(req,res)=>{
    try {
        let userName = await getUserName(req)
        let {title,disc,tags,category} = await req.body
        let allCat = ["all","art","tech","uiux","amvs","photoshop","games","other"]
        if(!allCat.includes(category.toLowerCase()))
            category = "other"
        if(category.toLowerCase() == 'ui/ux')
            category = "uiux"
        if(title.length > 50 && disc.length > 550 && tags.length >= 50)
            return res.json({msg:"Too long FFFFF",status:400})
        let buffer = await req.file.buffer
        let cldUploadStream = cloudinary.uploader.upload_stream({
            folder:`${userName}/posts/`,
            height: 500, width: 500, crop: "scale",
            },async(err,response)=>{
                let imageName = (response.public_id.split('/'))[((response.public_id.split('/'))).length-1]
                if (err) return res.send(err)
                let imgURL = response.secure_url
                await userDB.doc(`${userName}`).set({exists:true},{merge:true})
                let today = new Date();
                let dd = String(today.getDate()).padStart(2, '0')
                let mm = String(today.getMonth() + 1).padStart(2, '0')
                let yyyy = today.getFullYear()

                today = mm + '/' + dd + '/' + yyyy
                await userDB.doc(`${userName}`).collection(`posts`).doc(imageName).set({
                    title:title,
                    disc:disc,
                    public_id:response.public_id,
                    img:imgURL,
                    tags:tags.split(' ').filter(Boolean),
                    date:today,
                    category:category
                },{merge:true})
                let followersSnap = await userDB.doc(userName).collection('followers').get()
                let followers = followersSnap.docs.map(doc=>{
                    return doc.id
                })
                let user = await getUser(userName)
                followers.forEach(async follower=>{
                    await notify(follower,`${userName} uploaded a post`,`Check out ${userName}'s post`,`/postPreview?user=${userName}&&postNum=${imageName}`,user.profilePic)
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
        let isDeletable = false
        if(userName == query.user)
            isDeletable = true
        if(!query.user || !query.postNum)
            return res.send({success:false})
        let userCheck = (await userDB.doc(query.user).get()).data()
        if(!userCheck)
        return res.send({success:false})
        let postCheck = (await userDB.doc(query.user).collection('posts').doc(query.postNum).get()).data()
        if(!postCheck)
        return res.send({success:false})
        let postUser = await getUser(query.user)
        let profilePic = ""
        if(req.isAuthenticated()){
            let user = await getUser(userName)
            profilePic = user.profilePic
        }
        if(!query.user || !query.postNum)
            return res.send("No Post Found")
        let isComment = false
        let commentsArray = []
        let postData = (await userDB.doc(query.user).collection('posts').doc(query.postNum).get()).data()
        let commentSnapshot = await userDB.doc(query.user).collection('posts').doc(query.postNum).collection('comments').get()
        let likeSnap = (await userDB.doc(query.user).collection('posts').doc(query.postNum).collection('likes').get())
        let likes  = likeSnap.size
        let likesArray = likeSnap.docs.map(doc=>doc.data().user)
        let isLiked = false
        if(likesArray.includes(userName))isLiked=true
        if(!commentSnapshot.empty){
            isComment = true
            commentsArray = await Promise.all(commentSnapshot.docs.map(async doc=>{
                let data = doc.data()
                data['commentNum'] = doc.id
                let userData = await getUser(data.user)
                data['profilePic'] = userData.profilePic
                data['verified'] = userData.verified
                if(data.user == userName)
                    data['own'] = true
                else
                    data['own'] = false
                return data
            }))
        }
        let err = false
        if(postData == undefined){
            postData = {}
            postData['img'] = "https://www.publicdomainpictures.net/pictures/280000/nahled/not-found-image-15383864787lu.jpg"
            postData['title'] = "ERRRRR"
            postData['disc'] = "ERRRRRR"
            err = true
        }
        res.render('viewPost',{layout:'indexLayout',isLiked,likes,commentsQty:commentSnapshot.size,verified:postUser.verified,isDeletable:isDeletable,posterProfilePic:postUser.profilePic,date:postData.date,postUser:query.user,commentsArray:commentsArray,isComment:isComment,tags:postData.tags,imgURL:postData.img,title:postData.title,disc:postData.disc,err:err,postNum:query.postNum,isAuth:req.isAuthenticated(),profilePic:profilePic})
        
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
        if(followUserName == userName)
            return res.send("You cant follow yourself... idiot!!")
        if(await checkIfDocExists(userDB.doc(userName).collection('following'),followUserName))
            return res.send("You already follow this user")
        await userDB.doc(followUserName).collection('followers').doc(userName).set({exists:true})
        await userDB.doc(userName).collection('following').doc(followUserName).set({exists:true})
        const {profilePic} = await getUser(userName)
        await notify(followUserName,`${userName} followed`,`${userName} has followed you on mento`,`/notifications`,`${profilePic}`)
        res.send({msg:"Followed"})
    }
    catch(err){
        console.log(err)
    }
}
const unfollowUser = async(req,res)=>{
    try{
        const {unFollowUserName} = await req.body
        let userName = await getUserName(req)
        if(!await checkIfUserExists(unFollowUserName))
            return res.send("User doesnt exists")
        if(unFollowUserName == userName)
            return res.send("You cant unfollow yourself... idiot!!")
        if(!await checkIfDocExists(userDB.doc(userName).collection('following'),unFollowUserName))
            return res.send("You are not following this user")
        await userDB.doc(unFollowUserName).collection('followers').doc(userName).delete()
        await userDB.doc(userName).collection('following').doc(unFollowUserName).delete()
        const {profilePic} = await getUser(userName)
        await notify(unFollowUserName,`${userName} unfollowed`,`${userName} has unfollowed you on mento`,`/notifications`,`${profilePic}`)
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
        if(body.password.length < 8)
            return res.render('register',{layout:'registerLayout',err:true,msg:"Password too short"})
        if(body.name.length < 5)
            return res.render('register',{layout:'registerLayout',err:true,msg:"Username not length too small"})
        if(body.name.length > 20)
            return res.render('register',{layout:'registerLayout',err:true,msg:"Username not length too large"})
        if(body.name.includes('%'))
            return res.render('register',{layout:'registerLayout',err:true,msg:"% sign cant be included sowwy"})
        validator.verify(body.email,async (err,response) => {
            let users = userSnapshot.docs.map(doc=>{
            if(doc.data().name)
                return doc.data()
            })
            users = users.filter(e=>e!==undefined)
            for(i=0;i<users.length;i++){
            if(users[i].name == body.name)
            return res.render('register',{layout:'registerLayout',err:true,msg:"Another user with same name already exists"})
            if(users[i].email == body.email)
            return res.render('register',{layout:'registerLayout',err:true,msg:"Another user with same email alredy exists"})
            }
            const hashedPasswrod = await bcrypt.hash(body.password,10)
            let userInfoObj = {
            name:body.name,
            email:body.email,
            password:hashedPasswrod,
            image:'https://media.istockphoto.com/vectors/anonymity-concept-icon-in-neon-line-style-vector-id1259924572?k=20&m=1259924572&s=612x612&w=0&h=Xeii8p8hOLrH84PO4LJgse5VT7YSdkQY_LeZOjy-QD4=',
            paypal:"www.paypal.com/",
            banner:"http://localhost:1000/assets/img/grid.jpg"
            }
            let docref = await unVerifiedDB.add(userInfoObj)
            let transporter = emailer.createTransport({
                service:'gmail',
                auth:{
                    user:process.env.BUISSNESS_EMAIL,
                    pass:process.env.BUISSNESS_EMAIL_PASSWORD
                }
            })
            await transporter.sendMail({
                from:process.env.BUISSNESS_EMAIL,
                to:body.email,
                subject:'Verification link',
                text:`The verifiation link is ${process.env.VERIFY_LINK}?id=${docref.id}`,
                html:`<h1>Mento</h1><br><h3>The verifiation link is ${process.env.VERIFY_LINK}?id=${docref.id}</h3>`
            })
            return res.redirect('login')
        })
    }
    catch(err){
        console.log(err)
    }
}
const loginPost = async(req,res)=>{
    try{
        let body = await req.body
        if(!body.password || !body.email)
            return res.render('login',{layout:'loginLayout',err:true,msg:"Fields missing"})
        let snap = await userDB.where('email', '==', body.email).get()
        let userName = snap.docs.map(doc=>{return doc.id})
        userName = userName.filter(e=>e!==undefined)
        userName = userName[0]
        body['name'] = userName
        if(!userName)
            return res.render('login',{layout:'loginLayout',err:true,msg:"Wrong Email"})
        bcrypt.compare(body.password,((await userDB.doc(userName).get()).data()).password,(err,bcResponse)=>{
            if(!bcResponse)
                return res.render('login',{layout:'loginLayout',err:true,msg:"Wrong Password"})
            req.login(body,(error,response)=>{
            })
            return res.redirect('/')
        })
    }
    catch(err){
        console.log(err)
    }
}
const verifyUser = async(req,res)=>{
    try{
        const {id} = await req.query
        let credentials = (await unVerifiedDB.doc(id).get()).data()
        if(!credentials)
            return res.send('Wrong verification id or user already exists')
        if((await userDB.doc(credentials.name).get()).data())
            return res.send('User already exists')
        await userDB.doc(credentials.name).set(credentials)
        await unVerifiedDB.doc(id).delete()
        res.redirect('login')
    }
    catch(err){
        console.log(err)
    }
}
const logout = async(req,res)=>{
    await req.logout()
    res.end()
}
const changeCredentials = async(req,res)=>{
    try{
        let userName = await getUserName(req)
        let {cred} = await req.body
        switch(cred){
            case 'password':
                let {newElement} = await req.body
                if(newElement.length < 8)
                    return res.send({success:false,msg:"Password too short"})
                let {currentElement} = await req.body
                let currentPassword = (await userDB.doc(userName).get()).data()
                currentPassword = currentPassword.password
                bcrypt.compare(currentElement,currentPassword,async function(err,response){
                    if(response){
                        let newHashedPassword = await bcrypt.hash(newElement,10)
                        await userDB.doc(userName).update({password:newHashedPassword})
                        return res.send({success:true,msg:"Changed"})
                    }
                    else{
                        return await res.send({success:false,msg:"Passwords didnt match"})
                    }
                })
                return
            case 'profilePic':
                if(!req.file)
                    return res.send({success:false,msg:'File not found'})
                let buffer = req.file.buffer
                let cldstrm =  cloudinary.uploader.upload_stream({
                    public_id:`${userName}/profilePic`,
                    height: 500, width: 500, crop: "scale",
                },async(err,response)=>{
                    let URL = response.secure_url;
                    await userDB.doc(userName).update({image:URL})
                    return res.send({success:true,msg:"Changed"})
                })
                return streamify.createReadStream(buffer).pipe(cldstrm)
            case "banner":
                if(!req.file)
                    return res.send({success:false,msg:'File not found'})
                    let bufferB = req.file.buffer
                    let cldstrmB =  cloudinary.uploader.upload_stream({
                        public_id:`${userName}/banner`,
                        height: 400, width: 1200, crop: "scale",
                    },async(err,response)=>{
                        let URL = response.secure_url;
                        await userDB.doc(userName).update({banner:URL})
                        return res.send({success:true,msg:"Changed"})
                    })
                return streamify.createReadStream(bufferB).pipe(cldstrmB)
                case 'account':
                let {newPaypal,bio} = await req.body
                if(newPaypal.length != 0)
                    await userDB.doc(userName).update({paypal:newPaypal})
                if(bio.length != 0)
                    await userDB.doc(userName).set({bio:bio},{merge:true})
                return res.send({success:true,msg:"Changed"})
            default:return res.send({success:false,msg:"No lol"}).status(400)
        }
    }
    catch(err){
        console.log(err)
    }
}
const chatRoom = async(req,res)=>{
    try{
        let roomID
        const userName = await getUserName(req)
        const{user} = await req.query
        if(!await checkIfDocExists(userDB,user))
            return res.send(`${user} doesnt exist`)
        if(userName != userName && userName != user)
            return res.send("Access denied")
        if(userName == user)
            return res.send('You cant chat with yourself looser loner garbage')
        const snap = await chatRoomDB.get()
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
            let response = await chatRoomDB.add({users:[userName,user]})
            roomID = response.id
        }
        let chats = await chatRoomDB.doc(roomID).collection('chats').orderBy('time').get()
        chats = chats.docs.map(doc=>{return doc.data()})
        return res.send({chats:chats,chatRoomId:response.id})
    }catch(err){
        console.log(err)
    }
}
const getChatMembers = async(req,res)=>{
    try{
        const userName = await getUserName(req)
        let chatsSnap = await chatRoomDB.where('users','array-contains',`${userName}`).get()
        if(!chatsSnap)
            return res.send({chats:[]})
        let chats = []
        let users = []
        await Promise.all(chatsSnap.docs.map(async doc=>{
            let data = doc.data()
            data.users = data.users.filter(e=>e!==`${userName}`)
            data.users = data.users[0]
            if(users.includes(data.users))
                return await chatRoomDB.doc(doc.id).delete()
            users.push(data.users)
            data['userData'] = await getUser(data.users)
            let unRead = ((await userDB.doc(userName).collection('unRead').doc(data.users).get()).data())
            data['unread'] = (unRead)?unRead.num:0
            chats.push({...data,...{id:doc.id}})
        }))
        function compare( a, b ) {
            if ( a.time > b.time ){
              return -1;
            }
            if ( a.time < b.time ){
              return 1;
            }
            return 0;
        }
        chats = chats.sort(compare)
        return res.send({chats:chats})
    }
    catch(err){
        console.log(err)
    }
}
const getUserApi = async(req,res)=>{
    try{
        if(await checkIfUserExists(req.query.user) && req.query.user)
            return res.send(await getUser(req.query.user))
        return res.send("No user found") 
    }catch(err){
        console.log(err)
    }    
}
const addLike = async(req,res)=>{
    try{
        const userName = await getUserName(req)
        const {user,postNum} = await req.body
        if((await userDB.doc(user).collection('posts').doc(postNum).collection('likes').where('user','==',userName).get()).docs[0])
            return res.send({success:false,msg:"User already liked"})
        await userDB.doc(user).collection('posts').doc(postNum).collection('likes').add({user:userName})
        return res.send({success:true,msg:"Like Added"})
    }catch(err){
        console.log(err)
    }
}
const removeLike = async(req,res)=>{
    try{
        const userName = await getUserName(req)
        const {user,postNum} = await req.body
        let likeDoc = (await userDB.doc(user).collection('posts').doc(postNum).collection('likes').where('user','==',userName).get()).docs[0]
        if(!likeDoc)
            return res.send({success:false,msg:"User didn't like"})
        await userDB.doc(user).collection('posts').doc(postNum).collection('likes').doc(likeDoc.id).delete()
        return res.send({success:true,msg:"Like Removed"})
    }catch(err){
        console.log(err)
    }
}
const getLikes = async(req,res)=>{
    try{
        const {postNum,user} = await req.query
        let likeSnap = await userDB.doc(user).collection('posts').doc(postNum).collection('likes').get()
        if(likeSnap.size == 0){
            return res.send([])
        }
        return res.send(likeSnap.docs.map(doc=>{
            let data = doc.data()
            data['id'] = doc.id
            return data
        }))
    }catch(err){
        console.log(err)
    }
}
const test = async (req,res,next)=>{
    res.send(await checkIfFollowing('Pravith B A',"Phalicyy"))
}

// CUSTOM FUNCTIONS
async function notify(userName,title,disc,link,image){
    try{
        let push = (await userDB.doc(userName).get()).data()
        push = push.push
        if(!push)
            return "User Doesnt have push"
        let pushSubscription = push
        if(typeof push == 'string')
            pushSubscription = JSON.parse(push)
        let payloadObj = {title:title,disc:disc,link:link,image:image}
        await userDB.doc(userName).collection('notifications').add({title:payloadObj.title,disc:payloadObj.disc,link:payloadObj.link,image:image},{merge:true})
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
    return true
    if(checkUser == user)return true
    let visibality = (await userDB.doc(user).get()).data()
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
    (userInfo)?userName=userInfo.name:userName=undefined
    return userName
}
async function getUser(userName,showPassword){
    try{
        const userData = (await userDB.doc(userName).get()).data()
        if(!userData){
            return {
                "userName":'deletedUser',
                "userEmail":'deletedUserEmail',
                "profilePic":'https://media.istockphoto.com/vectors/anonymity-concept-icon-in-neon-line-style-vector-id1259924572?k=20&m=1259924572&s=612x612&w=0&h=Xeii8p8hOLrH84PO4LJgse5VT7YSdkQY_LeZOjy-QD4=',
                "verified":false,
                "paypal":'none'
            }
        }
        const {email,name,image,password,banner} = userData
        let userObject = {
            "userName":name,
            "userEmail":email,
            "profilePic":image,
            "verified":userData.verified,
            "paypal":userData.paypal,
            "banner":banner
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
        let post = await Promise.all(snapshot.docs.map(async doc=>{
            let data = doc.data()
            let likesArr = await userDB.doc(user).collection('posts').doc(doc.id).collection('likes').get()
            data['user'] = user
            data['postName'] = doc.id
            data['likes'] = (likesArr).size
            data['commentsQty'] = (await userDB.doc(user).collection('posts').doc(doc.id).collection('comments').get()).size
            data['likesArray'] = likesArr.docs.map(doc=>doc.data().user)
            return data
        }))
        posts.push(...post)
    }
    return posts
}
async function getAllUserPosts(userName){
    let snapshot = await userDB.doc(userName).collection('posts').get()
    let posts = await Promise.all(snapshot.docs.map(async doc=>{
        let data = doc.data()
        data['id'] = doc.id
        let likeSnap = await userDB.doc(userName).collection('posts').doc(doc.id).collection('likes').get()      
        data['likes'] = (likeSnap).size
        data['likesArray'] = likeSnap.docs.map(doc=>doc.data().user)
        data['commentsQty'] = (await userDB.doc(userName).collection('posts').doc(doc.id).collection('comments').get()).size
        return data
    }))
    return posts
}
async function checkIfDocExists(collectionRef,docName){
    let exists = false
    let snap = await collectionRef.get()
    snap.forEach(doc=>{if(doc.id == docName)exists = true})
    return exists
}
async function getAllPostsFiltered(attr,element){
    const allPosts = await getAllPosts()
    if(attr == 'cat'&&element == 'all')
            return await Promise.all(allPosts.map(async post=>{return {...post,...await getUser(post.user)}}))
    switch(attr){
        case 'cat':
            return await Promise.all(allPosts.filter(post=>{return post.category.toLowerCase() == element.toLowerCase()}).map(async post=>{return{...post,...await getUser(post.user)}}))
        case 'tags':
            return await Promise.all(allPosts.filter(post=>{return post.tags.includes(element.toLowerCase())}).map(async post=>{return {...post,...await getUser(post.user)}}))
        case 'title':
            return await Promise.all(allPosts.filter(post=>{return post.title.toLowerCase().includes(element.toLowerCase())}).map(async post=>{return {...post,...await getUser(post.user)}}))
        case 'search':
            return [...await Promise.all(allPosts.filter(post=>{return post.title.toLowerCase().includes(element.toLowerCase())}).map(async post=>{return {...post,...await getUser(post.user)}})),...await Promise.all(allPosts.filter(post=>{return post.tags.includes(element.toLowerCase())}).map(async post=>{return {...post,...await getUser(post.user)}}))].filter((v,i,a)=>a.findIndex(v2=>(v2.postName===v.postName&&v2.user===v.user))===i)
        default :
            return await Promise.all(allPosts.map(async post=>{return {...post,...await getUser(post.user)}}))

    }
}
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}
async function checkIfFollowing(user,checkUser){
    let followers = await userDB.doc(checkUser).collection('followers').get()
    return (followers.docs.some(doc => doc.id == user))
}
module.exports = {admin,userDB,chatRoomDB,addLike,removeLike,getLikes,getUserApi,checkIfDocExists,uploadPostPage,uploadFile,postPreviewPage,postComments,deleteComment,searchPage,followUser,assignNotif,test,assignNotif,unfollowUser,registerPost,loginPost,logout,changeCredentials,mainPage,login,register,profile,verifyUser,notifPage,deletePost,chatRoom,chatPage,settings,getChatMembers,checkIfUserExistsRoute}
