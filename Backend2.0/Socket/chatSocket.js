import { Server } from "socket.io";
import { Message } from "../Model/MessageModel.js";
import { Vehicle } from "../Model/VehicleModel.js";
import { Driver } from "../Model/DriverModel.js";



const users = {}

export function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: "*",
            credentials: true,
        },
    });


    io.on("connection", (socket) => {
        console.log("Connected:", socket.id);

        // save user id to the user object to get the socket id
        socket.on("join", (userId) => {
            users[userId] = socket.id;
            console.log("User joined:", userId);
        });

        // delete the user if when the uses is disconnected 
        socket.on("disconnect", () => {
            console.log("Disconnected:", socket.id);
            for (const [userId, sockId] of Object.entries(users)) {
                if (sockId === socket.id) {
                    delete users[userId];
                    break;
                }
            }
        });

        socket.on("private_message", async ({ sender, receiver, content }) => {
            const message = await Message.create({ sender, receiver, content });
            const receiverSocket = users[receiver];
            if (receiverSocket) {
                io.to(receiverSocket).emit("new_message", message);
                await Message.findByIdAndUpdate(message._id, { delivered: true });
            } else {
                console.log("Receiver offline. Message saved.");
            }
        });


        socket.on('startchat', async ({ sender, receiver, driverId, vehicleId }) => {
            const vehicle = await Vehicle.findById(
                vehicleId,
                {
                    _id: 1,
                    vehicleImages: 1
                },
            );
            const driver = await Driver.findById(
                driverId,
                {
                    _id: 1,
                    driverImage: 1
                }
            )
            const receiverSocket = users[receiver];
        })
    })
}