import mongoose from "mongoose";
import { Message } from "../Model/MessageModel.js";

export const getMyChats = async (req, res) => {
    try {

        const { userId } = req.params;
        console.log("Received userId:", userId);
        const myId = new mongoose.Types.ObjectId(userId);


        console.log("Fetching chats for user:", myId);

        // Validate userId
        if (!mongoose.Types.ObjectId.isValid(myId)) {
            return res.status(400).json({ error: "Invalid user ID." });
        }

        // Mark all messages sent TO me as delivered
        await Message.updateMany(
            { receiver: myId, delivered: false },
            { $set: { delivered: true } }
        );

        // Get all messages where I'm either the sender or receiver
        const chats = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: myId },
                        { receiver: myId }
                    ]
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                // Create a unique key for each conversation
                $addFields: {
                    chatWith: {
                        $cond: [
                            { $eq: ["$sender", myId] },
                            "$receiver",
                            "$sender"
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: "$chatWith", // Group by the other person
                    latestMessage: { $first: "$$ROOT" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id", // chatWith user ID
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            { $unwind: "$userDetails" },
            {
                $project: {
                    _id: 0,
                    userId: "$_id",
                    message: "$latestMessage.content",
                    timestamp: "$latestMessage.timestamp",
                    delivered: "$latestMessage.delivered",
                    images: { $ifNull: ["$latestMessage.images", []] },
                    sender: "$latestMessage.sender",
                    receiver: "$latestMessage.receiver",
                    user: {
                        _id: "$userDetails._id",
                        name: "$userDetails.name",
                        email: "$userDetails.email"
                    }
                }
            }
            ,
            {
                $sort: { timestamp: -1 }
            }
        ]);

        return res.status(200).json({ success: true, chats });

    } catch (error) {
        console.error("Error fetching unique chats:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getChatBetweenUsers = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    console.log("Received userId:", userId1, userId2);
    const id1 = new mongoose.Types.ObjectId(userId1);
    const id2 = new mongoose.Types.ObjectId(userId2);

    console.log("Fetching chat between users:", id1, "and", id2);
    // Validate user IDs
    if (!mongoose.Types.ObjectId.isValid(id1) || !mongoose.Types.ObjectId.isValid(id2)) {
      return res.status(400).json({ error: "Invalid user IDs." });
    }

    const chatMessages = await Message.find({
      $or: [
        { sender: id1, receiver: id2 },
        { sender: id2, receiver: id1 }
      ]
    })
    .sort({ timestamp: 1 }); // Sort oldest to newest

    return res.status(200).json({ success: true, messages: chatMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
