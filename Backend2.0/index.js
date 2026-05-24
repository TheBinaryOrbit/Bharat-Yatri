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
import { AdminRouter } from './Routers/AdminRouter.js'
import { User } from './Model/UserModel.js'
import { generalNotification } from './Notification/GeneralNotification.js'
import { time } from 'console'


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
app.use('/api/v2/bank', BankDetailsRouter)
app.use('/api/v2/booking', BookingRouter)
app.use('/api/v2/driver', DriverRouter)
app.use('/api/v2/freeerides', FreeVehicleRouter)
app.use('/api/v2/subscriptionpurchase', SubscriptionPurchaseRouter)
app.use('/api/v2/subscription', SubscriptionRouter)
app.use('/api/v2/upi', UpiRouter)
app.use('/api/v2/user', UserRouter)
app.use('/api/v2/vehicle', VehicleRouter)
app.use('/api/v2/message', MessageRouter)
app.use('/api/v2/admin', AdminRouter)


app.get('/', (req, res) => {
    console.log('User IP :', req.ip);
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('User IP :', ip);
    console.log('User Agent :', req.headers['user-agent']);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Har Har Mahadev')
})

// get notificaiton by phonenumber
app.get('/api/v2/notification/:phonenumber', async (req, res) => {
    const phonenumber = req.params.phonenumber;
    const user = await User.findOne({ phoneNumber: phonenumber });

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const fcmToken = user.fcmToken;
    console.log('User:', user.name);
    console.log('FCM Token:', fcmToken);

    // ✅ title and body as SEPARATE params, not inside data
    await generalNotification({
            userarray: [fcmToken],
            title: "New Ride Request 🚗",           // ← separate
            body: "Pickup: Muradnagar → Noida Sector 62",  // ← separate
            data: {
                "title": "New Ride Request 🚗",
                "body": "Pickup: Muradnagar → Noida Sector 62",
                "to": "Noida Sector 62",
                "pickupLocation": "Muradnagar",
                "rideId" : "65f1a2b3c4d5e6f789012345",
                "pickUpDateTime": "2026-03-22T10:30:00.000Z",
                "vehicleType": "SEDAN",
                "passangerCount": "3",
                "fare": "450",
                "estimatedDistance": "28",
                "estimatedDuration": "50",
                "rideType": "QUICKRIDE",
                "bookedBy": "65f1a2b3c4d5e6f789012345",
                "assingTo": "65f1a2b3c4d5e6f789012399",
                "rideStatus": "ACCEPTED",
                "startOtp": "1234",
                "startOtpExpiresAt": "2026-03-22T10:40:00.000Z",
                "isLater": "false",
                "expiresAt": "2026-03-22T11:30:00.000Z"
            }
    });

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Notification sent to: ' + phonenumber);
});

// listing server at PORT i.e in .env file
server.listen(PORT, () => {
    console.log(`Server Started As ${PORT}`);
})