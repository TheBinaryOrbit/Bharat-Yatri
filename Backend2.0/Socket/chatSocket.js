import { Server } from "socket.io";
import { Message } from "../Model/MessageModel.js";
import { Vehicle } from "../Model/VehicleModel.js";
import { Driver } from "../Model/DriverModel.js";
import { User } from "../Model/UserModel.js";
import { sendChatNotification } from "../Notification/chatNotification.js";

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
                // Emit to receiver: chat list item update
                const user = await User.findById(sender).select("name email");

                // Check if receiver is online
                const receiverSocket = users[receiver];
                const senderSocket = users[sender];

                console.log("Receiver socket:", senderSocket);
                


                if (receiverSocket) {
                    console.log(receiverSocket);
                    // Mark as delivered
                    await Message.findByIdAndUpdate(message._id, { delivered: true });

                    // Emit to receiver: chat thread (if open)
                    io.to(receiverSocket).emit("new_message", message);


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
                    sendChatNotification(user.name, receiver, content);
                    console.log("Receiver offline. Message saved.");
                }
            } catch (err) {
                console.error("Error handling private_message:", err);
            }
        });

        socket.on("startchat", async ({ sender, receiver, driverId, vehicleId }) => {
            try {

                console.log("startchat", sender, receiver, driverId, vehicleId);

                // if (!mongoose.Types.ObjectId.isValid(sender) || !mongoose.Types.ObjectId.isValid(receiver)) {
                //     return;
                // }

                const images = [];

                const senderDetails = await User.findById(sender);
                const receiverDetails = await User.findById(receiver);

                const driver = await Driver.findById(driverId);
                images.push(driver.driverImage)



                const vehicle = await Vehicle.findById(vehicleId);
                images.push(...vehicle.vehicleImages)


                console.log(images);
                // Create and save the message
                const message = await Message.create({ sender, receiver, content: `Namaste ${receiverDetails.name}, aapki ride dekh kar kaafi achha laga! Driver ka naam hai: ${driver.name}. Kripya confirm kijiye agar yeh available ho. Dhanyavaad!`, images });

                // Check if receiver is online
                const receiverSocket = users[receiver];


                if (receiverSocket) {
                    // Mark the message as delivered
                    await Message.findByIdAndUpdate(message._id, { delivered: true });

                    

                    // Construct the single chat item object
                    const latestChatItem = {
                        senderId: sender,
                        message: `Namaste ${receiverDetails.name}, aapki ride dekh kar kaafi achha laga! Driver ka naam hai: ${driver.name}. Kripya confirm kijiye agar yeh available ho. Dhanyavaad!`,
                        images: images,
                        timestamp: message.timestamp,
                        sender: {
                            _id: senderDetails._id,
                            name: senderDetails.name,
                            email: senderDetails.email
                        }
                    };

                    // Emit only the new chat item to receiver
                    io.to(receiverSocket).emit("chat_list_item_update", latestChatItem);

                } else {
                    sendChatNotification(senderDetails.name, receiver, `Namaste ${receiverDetails.name}, aapki ride dekh kar kaafi achha laga! Driver ka naam hai: ${driver.name}. Kripya confirm kijiye agar yeh available ho. Dhanyavaad!`)   ;
                    console.log("Receiver offline. Message saved.");
                }
            } catch (err) {
                console.error("Error handling sent_to_chat_list:", err);
            }
        });
    })
}