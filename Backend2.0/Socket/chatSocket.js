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
            console.log("akjn "+users?.[userId])
            if(users?.[userId] !== undefined) {
                console.log("User already connected:", userId);
            } else {
                users[userId] = socket.id;
                console.log("User joined:", userId);
            }
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

        socket.on("private_message", async ({ sender, receiver, content, bookingId, images = [] }) => {
            try {

                console.log("Received private_message:", { bookingId, sender, receiver, content, images });
                // Step 1: Create message document
                const message = await Message.create({
                    sender,
                    receiver,
                    content,
                    bookingId,
                    images,
                    delivered: false // default; may update below
                });

                // Step 2: Get sender details for UI
                const user = await User.findById(sender).select("name email");

                const receiverSocket = users[receiver]; // map of connected users
                const senderSocket = users[sender];

                // Step 3: If receiver is online
                if (receiverSocket) {
                    console.log("Receiver is online:", receiverSocket , receiver);

                    // Mark message as delivered immediately
                    // await Message.findByIdAndUpdate(message._id, { delivered: true });

                    // Emit the message in the receiver’s open chat thread
                    io.to(receiverSocket).emit("new_message", {
                        _id: message._id,
                        sender,
                        receiver,
                        content,
                        images,
                        bookingId,
                        delivered: true,
                        timestamp: message.timestamp
                    });

                    // Emit/update receiver's chat list
                    const latestChatItem = {
                        senderId: sender,
                        message: content,
                        timestamp: message.timestamp,
                        bookingId: bookingId,
                        sender: {
                            _id: user._id,
                            name: user.name,
                            email: user.email
                        }
                    };

                    io.to(receiverSocket).emit("chat_list_item_update", latestChatItem);
                } else {
                    // Step 4: Receiver is offline – no real-time delivery
                    sendChatNotification(user.name, receiver, content);
                    console.log("Receiver offline. Message saved for later.");
                }

                // Step 5: Optionally notify sender their message was sent (ack)
                if (senderSocket) {
                    io.to(senderSocket).emit("message_sent", {
                        success: true,
                        messageId: message._id,
                        timestamp: message.timestamp
                    });
                }

            } catch (err) {
                console.error("Error handling private_message:", err);
                if (users[sender]) {
                    io.to(users[sender]).emit("error", { message: "Failed to send message." });
                }
            }
        });


        socket.on("startchat", async ({ sender, receiver, driverId, bookingId, vehicleId }) => {
            try {

                console.log("startchat event received:", {

                    bookingId,
                });
                console.log("startchat:", sender, receiver, driverId, bookingId, vehicleId);

                // Validate required fields
                if (!sender || !receiver || !driverId || !bookingId || !vehicleId) {
                    console.warn("Missing data in startchat event.");
                    return;
                }

                const senderDetails = await User.findById(sender).select("name email");
                const receiverDetails = await User.findById(receiver).select("name email");

                if (!senderDetails || !receiverDetails) {
                    console.warn("Sender or Receiver not found.");
                    return;
                }

                const driver = await Driver.findById(driverId)
                const vehicle = await Vehicle.findById(vehicleId)

                if (!driver || !vehicle) {
                    console.warn("Driver or Vehicle not found.");
                    return;
                }

                // Collect images (driver + vehicle)
                const images = [];
                if (driver.driverImage) images.push(driver.driverImage);
                if (vehicle.vehicleImages?.length > 0) images.push(...vehicle.vehicleImages);

                // Message content
                const content = `Namaste, \n Driver Name : ${driver.name},\n Contact : ${driver.phone},\n Vehicle : ${vehicle.vehicleType},\n vehicle Number : ${vehicle.registrationNumber}`;

                // Create message
                const message = await Message.create({
                    sender,
                    receiver,
                    content,
                    bookingId,
                    images,
                    delivered: false
                });

                const receiverSocket = users[receiver];

                // If receiver is online
                if (receiverSocket) {
                    // Mark message as delivered
                    // await Message.findByIdAndUpdate(message._id, { delivered: true });

                    // Emit new message to receiver (in thread)
                    io.to(receiverSocket).emit("new_message", {
                        _id: message._id,
                        sender,
                        receiver,
                        content,
                        bookingId,
                        images,
                        timestamp: message.timestamp,
                        delivered: true
                    });

                    // Update receiver's chat list
                    const latestChatItem = {
                        senderId: sender,
                        message: content,
                        images,
                        timestamp: message.timestamp,
                        bookingId,
                        sender: {
                            _id: senderDetails._id,
                            name: senderDetails.name,
                            email: senderDetails.email
                        }
                    };

                    io.to(receiverSocket).emit("chat_list_item_update", latestChatItem);
                } else {
                    // Receiver offline — send push/email/etc. notification
                    sendChatNotification(senderDetails.name, receiver, content);
                    console.log("Receiver offline. Message saved.");
                }

                // Optional: notify sender their message was sent
                const senderSocket = users[sender];
                if (senderSocket) {
                    io.to(senderSocket).emit("message_sent", {
                        success: true,
                        bookingId,
                        timestamp: message.timestamp
                    });
                }

            } catch (err) {
                console.error("Error handling startchat event:", err);
                const senderSocket = users[sender];
                if (senderSocket) {
                    io.to(senderSocket).emit("error", {
                        message: "Failed to start chat."
                    });
                }
            }
        });

    })
}