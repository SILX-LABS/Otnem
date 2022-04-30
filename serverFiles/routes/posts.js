const express = require('express')
const {uploadPostPage, uploadFile, postPreviewPage, postComments, deleteComment, searchPage, followUser, test, assignNotif, unfollowUser, admin, registerPost, logout, changeCredentials, mainPage, login, register, profile, verifyUser, loginPost, notifPage, deletePost} = require("../controllers/posts.js")
const mutler = require('multer')
const router = express.Router()
const upload = mutler()
const passport = require('passport')

router.get('/',mainPage)
router.get('/login',checkNotAuth,login)
router.get('/register',checkNotAuth,register)
router.get('/post',checkAuth,uploadPostPage)
router.get('/postPreview',postPreviewPage)
router.get('/search',searchPage)
router.get('/profile',checkAuth,profile)
router.get('/verify',checkNotAuth,verifyUser)
router.get('/notifications',checkAuth,notifPage)
router.post('/upload',checkAuth,upload.single('upload_file'),uploadFile)
router.post('/comment',checkAuth,postComments)
router.post('/follow',checkAuth,followUser)
router.post('/asignNotification',checkAuth,assignNotif)
router.post('/unfollow',checkAuth,unfollowUser)
router.post('/test',test)
router.post('/register',checkNotAuth,registerPost)
router.post('/login',checkNotAuth,loginPost)
router.post('/changeCred',checkAuth,changeCredentials)
router.delete('/logout',checkAuth,logout)
router.delete('/deleteComment',checkAuth,deleteComment)
router.delete('/deletePost',checkAuth,deletePost)

// CUSTOM FUNCTIONS
function checkAuth(req,res,next){
    if(req.isAuthenticated()){
        next()
    }
    else{
        return res.redirect('login')
    }
}
function checkNotAuth(req,res,next){
    if(!req.isAuthenticated()){
        next()
    }
    else{
        return res.redirect('/')
    }
}

module.exports = router