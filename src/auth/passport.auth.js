import passport from "passport";
import LocalStrategy from 'passport-local';
import userModel from '../models/user.model.js';
import { createHash, isValidPassword } from '../utils.js';
import GithubStrategy from 'passport-github2';
import { UserDTO } from "../repositories/users.repository.js";
import cartModel from '../models/cart.model.js'

const initPassport = () => {
    const verifyRegistration = async (req, username, password, done) => {
        try{
            const user = await userModel.findOne({email: username})

            if(user){
                return done('Ya hay un usuario registrado con este mail', false)
            }

            const newUser = {
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                email: username,
                age: req.body.age,
                password: createHash(password),
                thumbnails: req.file.path,
                last_connection: true,
                last_connection_date: new Date()
            }
            const normalizedUser = new UserDTO(newUser);
            const saveUser = normalizedUser.getUser();
            
            let createUser = await userModel.create(saveUser);
            const newCart = await cartModel.create({products: [], total: 0});
            createUser = await userModel.findByIdAndUpdate(createUser._id, { $set: { cartId: newCart._id } }, { new: true }); 


            return done(null, createUser)
        }catch(err){
            return done('error passport local', err.message)
        }
    }

    passport.use('registerAuth', new LocalStrategy({
        passReqToCallback: true,
        usernameField: 'email',
        passwordField: 'pass'
    }, verifyRegistration))


    // const verifyRestoration = async(req, username, password, done) => {
    //     try{
    //         const user = await userModel.findOne({ email: username })

    //         if (!user) return done('No existe un usuario registrado con este mail', false)

    //         const newPassword = await userModel.findOneAndUpdate({email: username}, {password: createHash(password)})

    //         return done(null, newPassword);
    //     }catch(err){
    //         return done('error passport local', err.message);
    //     }
    // }

    // passport.use('restoreAuth', new LocalStrategy({
    //     passReqToCallback: true,
    //     usernameField: 'email',
    //     passwordField: 'pass'
    // }, verifyRestoration))


    const verifyLogin = async(req, username, password, done) =>{
        const user = await userModel.findOne({email: username})

        if(!user){
            return done('Usuario o contraseña incorrecta', false)
        }

        if(user !== null && isValidPassword(user, password)){
            const login = await userModel.findByIdAndUpdate(
                user._id,
                {$set: {last_connection: true, last_connection_date: new Date()}},
                {new: true}
            )
            return done(null, login)
        }else{
            return done('error en passport local', false)
        }
    }

    passport.use('loginAuth', new LocalStrategy({
        passReqToCallback: true,
        usernameField: 'email',
        passwordField: 'pass'
    }, verifyLogin))


    const verifyGithub = async(accessToken, refreshToken, profile, done) => {
        try{
            const user = await userModel.findOne({email: `${profile._json.login}@gmail.com`}) 
            //Mi perfil de GitHub no deja visualizar el email (retorna null)
            if(!user){
                const newUser = {
                    first_name: profile._json.login,
                    last_name: profile._json.login,
                    email: `${profile._json.login}@gmail.com`,
                    password: ' ',
                    last_connection_date: new Date()
                }
            
                let process = await userModel.create(newUser);
                const newCart = await cartModel.create({products: [], total: 0});
                process = await userModel.findByIdAndUpdate(process._id, { $set: { cartId: newCart._id } }, { new: true }); 

                return done(null, process)
            }else{
                return done(null, user)
            }
        }catch(err){
            return done('error de passport github', err.message)
        }
    }

    passport.use('githubAuth', new GithubStrategy({
        clientID: process.env.clientId,
        clientSecret: process.env.clientSecret,
        callbackURL: process.env.callbackUrl
    }, verifyGithub))

    passport.serializeUser((user, done) => {
        done(null, user._id)
    })


    passport.deserializeUser(async (id, done) => {
        try {
            done(null, await userModel.findById(id).lean())
        } catch (err) {
            done(err.message)
        }
    })
}

export default initPassport