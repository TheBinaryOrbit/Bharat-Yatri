import { Server } from "socket.io";
import { Message } from "../Model/MessageModel.js";
import { Vehicle } from "../Model/VehicleModel.js";
import { Driver } from "../Model/DriverModel.js";
import { User } from "../Model/UserModel.js";
import mongoose from "mongoose";

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

        socket.on("private_message", async ({ sender, receiver, content, images = [] }) => {
            try {
                // Create the message (with optional images)
                const message = await Message.create({ sender, receiver, content, images });

                // Check if receiver is online
                const receiverSocket = users[receiver];

                if (receiverSocket) {
                    // Mark as delivered
                    await Message.findByIdAndUpdate(message._id, { delivered: true });

                    // Emit to receiver: chat thread (if open)
                    io.to(receiverSocket).emit("new_message", message);

                    // Emit to receiver: chat list item update
                    const user = await User.findById(sender).select("name email");

                    const latestChatItem = {
                        senderId: sender,
                        message: content,
                        timestamp: message.timestamp,
                        sender: {
                            _id: user._id,
                            name: user.name,
                            email: user.email
                        }
                    };

                    io.to(receiverSocket).emit("chat_list_item_update", latestChatItem);
                } else {
                    console.log("Receiver offline. Message saved.");
                }
            } catch (err) {
                console.error("Error handling private_message:", err);
            }
        });

        socket.on("startchat", async ({ sender, receiver, driverId, vehicleId }) => {
            try {

                if (!mongoose.Types.ObjectId.isValid(sender) || !mongoose.Types.ObjectId.isValid(receiver)) {
                    return;
                }

                const images = [];

                const senderDetails = await User.findById(sender);
                const receiverDetails = await User.findById(receiver);

                const driver = await Driver.findById(driverId);
                images.push(driver.driverImage)



                const vehicle = await Vehicle.findById(vehicleId);
                images.push(...vehicle.vehicleImages)


                // Create and save the message
                const message = await Message.create({ sender, receiver, content: `Namaste ${receiverDetails.name}, main is ride mein interested hoon, Driver Name : ${driver.name}`, images });

                // Check if receiver is online
                const receiverSocket = users[receiver];


                if (receiverSocket) {
                    // Mark the message as delivered
                    await Message.findByIdAndUpdate(message._id, { delivered: true });

                    // Fetch sender details for the chat list card
                    const user = await User.findById(sender).select("name email");

                    // Construct the single chat item object
                    const latestChatItem = {
                        senderId: sender,
                        message: `Namaste ${receiverDetails.name}, main is ride mein interested hoon, Driver Name : ${driver.name}`,
                        images: images,
                        timestamp: message.timestamp,
                        sender: {
                            _id: user._id,
                            name: user.name,
                            email: user.email
                        }
                    };

                    // Emit only the new chat item to receiver
                    io.to(receiverSocket).emit("chat_list_item_update", latestChatItem);

                } else {
                    console.log("Receiver offline. Message saved.");
                }
            } catch (err) {
                console.error("Error handling sent_to_chat_list:", err);
            }
        });
    })
}