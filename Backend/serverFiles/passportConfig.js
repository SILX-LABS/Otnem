const localStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')

async function init(passport,getUserByEmail,getUserById){
    const authUser = async(email,password,done)=>{
        let user = await getUserByEmail(email)
        if(user == null){
            return done(null, false,{message:'<div class="error-msg"> No user with that email </div>'})
        }
        try{
            if(await bcrypt.compare(password,user.password)){
                return done(null,user)
            }else{
                return done(null,false,{message:'<div class="error-msg"> Password did not match </div>'})
            }
        }
        catch(e){

            return done(e)

        }

    }
    passport.use(new localStrategy({usernameField:'email'},authUser))
    passport.serializeUser((user,done)=>done(null,user.name))
    passport.deserializeUser(async(name,done)=>done(null,getUserById(name)))
}

module.exports = {init}