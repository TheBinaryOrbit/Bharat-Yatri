import express from 'express'
import 'dotenv/config'
import { Connectdatabase } from './DataBase/Dbconnection.js'
import { userRouter } from './Routers/UserRouter.js'
import { rideRouter } from './Routers/RideRouter.js'
import { SubscriptionRouter } from './Routers/SuscriptionRouter.js'
import { AdminRouter } from './Routers/AdminRouter.js'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'



const PORT = process.env.PORT;
const URL = process.env.DB_URL;
const app = express();

// connecting databases 
Connectdatabase(URL);

// Cross-origin
const corsOption  = {
    "origin": "*",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": false,
    "optionsSuccessStatus": 204
  }

app.use(cors(corsOption))

// data parser
app.use(express.json());
app.use(express.urlencoded({extended : true}));

// statics serving of publuc folder
const __filename = fileURLToPath(import.meta.url);
const __dirname =  path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/api/user' , userRouter)
app.use('/api/ride' , rideRouter)
app.use('/api/subscription' , SubscriptionRouter)
app.use('/api/admin' , AdminRouter);

// testing the backend by the '/' route
app.get('/' , (req , res)=>{
    console.log("get")
    res.end('Happy Server Started Sucessfully')
})


// listing server at PORT i.e in .env file
app.listen(PORT , ()=>{
    console.log(`Server Started As ${PORT}`);    
})
