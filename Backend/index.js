import express from 'express'
import 'dotenv/config'
import { Connectdatabase } from './DataBase/Dbconnection.js'
import { userRouter } from './Routers/UserRouter.js'
import { rideRouter } from './Routers/RideRouter.js'
import path from 'path'
import { fileURLToPath } from 'url'
const app = express()

// connecting databases 
const URL = process.env.DB_URL
Connectdatabase(URL)



// routes
app.use(express.json());
app.use(express.urlencoded({extended : true}));

// statics serving of publuc folder
const __filename = fileURLToPath(import.meta.url)
const __dirname =  path.dirname(__filename)
app.use('/public', express.static(path.join(__dirname + 'public')));


app.use('/api/user' , userRouter)
app.use('/api/ride' , rideRouter)

// testing the backend by the '/' route
app.get('/' , (req , res)=>{
    res.end('Happy Server Started Sucessfully')
})

// listing server at PORT i.e in .env file
const PORT = process.env.PORT
app.listen(PORT , ()=>{
    console.log(`Server Started As ${PORT}`);    
})
