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

webPush.setVapidDetails('mailto:pravithba10@gmail.com', process.env.PUBLIC_KEY,process.env.PRIVATE_KEY)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
})
const firebase = admin.firestore()
const userDB = firebase.collection('userData')
const unVerifiedDB = firebase.collection('unVerified')
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
    res.render('index',{isPost:isPost,len:finalArray.length,posts:finalArray,loggedIn:loggedIn,profilePic:userObj.profilePic,isAuth:req.isAuthenticated()})
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
        if(!query.user && !userName)
        return res.redirect('login')
        if(!query.user)
            return res.redirect('/')
        if(query.user)
            userName = query.user
        let userObj = await getUser(userName)
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
        posts.forEach(post=>{
        post['name'] = userName
        post['profilePic'] = userObj.profilePic
        })
        userObj['posts'] = posts
        let isPost = false
        if(posts[0])
            isPost = true
        userObj['isPost'] = isPost
        userObj['isAuth'] = req.isAuthenticated()
        res.render('profile',{layout:'profileLayout',userObj:userObj,isAuth:req.isAuthenticated()})
    }catch(err){
        console.log(err)
    }
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
        res.render('viewPost',{layout:'indexLayout',isDeletable:isDeletable,posterProfilePic:postUser.profilePic,date:postData.date,postUser:query.user,commentsArray:commentsArray,isComment:isComment,tags:postData.tags,imgURL:postData.img,title:postData.title,disc:postData.disc,err:err,postNum:query.postNum,isAuth:req.isAuthenticated(),profilePic:profilePic})
        
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
        await emailCheck.check(body.email,async(error,response)=>{
            if(!response)
                return res.render('register',{layout:'registerLayout',err:true,msg:"Email doesn't exist"})
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
            image:'https://media.istockphoto.com/vectors/anonymity-concept-icon-in-neon-line-style-vector-id1259924572?k=20&m=1259924572&s=612x612&w=0&h=Xeii8p8hOLrH84PO4LJgse5VT7YSdkQY_LeZOjy-QD4='
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
                from:'pravithba10@gmail.com',
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
            req.login(body,(error,response)=>{})
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
    console.log("\n===================\nAll :",await getAllPostsFiltered('fuajs='))
    console.log("\n===================\nCat :",await getAllPostsFiltered("cat","uiux"))
    console.log("\n===================\nTags :",await getAllPostsFiltered("tags","TaG1"))
    console.log("\n===================\nTitle :",await getAllPostsFiltered("title","All posts"))
    res.end()
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
async function getAllUserPosts(userName){
    let snapshot = await userDB.doc(userName).collection('posts').get()
    let posts = snapshot.docs.map(doc=>{
        let data = doc.data()
        data['id'] = doc.id
        return data
    })
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
module.exports = {admin,uploadPostPage,uploadFile,postPreviewPage,postComments,deleteComment,searchPage,followUser,assignNotif,test,assignNotif,unfollowUser,registerPost,loginPost,logout,changeCredentials,mainPage,login,register,profile,verifyUser,notifPage,deletePost}