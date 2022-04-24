const express = require('express')
const {uploadPostPage, uploadFile, postPreviewPage, postComments, deleteComment, searchPage, followUser, test, assignNotif, unfollowUser, admin, registerPost, logout, changeCredentials, mainPage} = require("../controllers/posts.js")
const mutler = require('multer')
const router = express.Router()
const upload = mutler()
const passport = require('passport')

router.get('/',mainPage)
router.get('/post',uploadPostPage)
router.get('/postPreview',postPreviewPage)
router.get('/search',searchPage)
router.post('/upload',checkAuth,upload.single('upload_file'),uploadFile)
router.post('/comment',checkAuth,postComments)
router.post('/follow',checkAuth,followUser)
router.post('/asignNotification',checkAuth,assignNotif)
router.post('/unfollow',checkAuth,unfollowUser)
router.post('/test',checkAuth,test)
router.post('/register',checkNotAuth,registerPost)
router.post('/login',checkNotAuth,passport.authenticate('local',{

    successRedirect:'/post',
    failureRedirect:'/login',
    failureFlash:true
    
}))
router.post('/changeCred',checkAuth,changeCredentials)
router.delete('/logout',checkAuth,logout)
router.delete('/deleteComment',checkAuth,deleteComment)

// CUSTOM FUNCTIONS
function checkAuth(req,res,next){
    if(req.isAuthenticated()){
        next()
    }
    else{
        res.send("NOOOO")
    }
}
function checkNotAuth(req,res,next){
    if(!req.isAuthenticated()){
        next()
    }
    else{
        res.send("NOOOO")
    }
}

module.exports = router