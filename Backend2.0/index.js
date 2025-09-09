import express from 'express'
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import { Connectdatabase } from './Database/Dbconnection.js'
import { BankDetailsRouter } from './Routers/BankDetailsRouter.js'
import { DriverRouter } from './Routers/DriverRouter.js'
import { FreeVehicleRouter } from './Routers/FreeVehicleRouter.js'
import { SubscriptionRouter } from './Routers/SubscriptionRouter.js'
import { UpiRouter } from './Routers/UpiRouter.js'
import { UserRouter } from './Routers/UserRouter.js'
import { VehicleRouter } from './Routers/VehicleRouter.js'
import { BookingRouter } from './Routers/BookingRouter.js'
import { SubscriptionPurchaseRouter } from './Routers/SubscriptionPurchaseRouter.js'

import { createServer } from 'http'
import { initSocket } from './Socket/chatSocket.js'
import { MessageRouter } from './Routers/MessageRouter.js'
import travelAgencyRouter from './Routers/TravelAgencyRouter.js';


const PORT = process.env.PORT;
const URL = process.env.DB_URL;

const app = express();

// connecting databases 
Connectdatabase(URL);


export const server = createServer(app)
initSocket(server);
// Cross-origin
const corsOption = {
    "origin": "*",
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": false,
    "optionsSuccessStatus": 204
}

app.use(cors(corsOption))

// data parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// statics serving of publuc folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));


// all routes
app.use('/api/v2/bank' , BankDetailsRouter)
app.use('/api/v2/booking' , BookingRouter)
app.use('/api/v2/driver' , DriverRouter)
app.use('/api/v2/freeerides' , FreeVehicleRouter)
app.use('/api/v2/subscriptionpurchase' , SubscriptionPurchaseRouter)
app.use('/api/v2/subscription' , SubscriptionRouter)
app.use('/api/v2/upi' , UpiRouter) 
app.use('/api/v2/user' , UserRouter)
app.use('/api/v2/vehicle' , VehicleRouter)
app.use('/api/v2/message' , MessageRouter)
app.use('/api/travel_agencies', travelAgencyRouter); // Mount TravelAgency routes under /api

app.get('/', (req, res) => {
    console.log('User IP :', req.ip);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('User IP :', ip);
    console.log('User Agent :', req.headers['user-agent']);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Har Har Mahadev')
})


// listing server at PORT i.e in .env file
server.listen(PORT, () => {
    console.log(`Server Started As ${PORT}`);
})
