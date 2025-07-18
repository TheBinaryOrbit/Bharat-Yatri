import mongoose from "mongoose";
import { Message } from "../Model/MessageModel.js";

export const getMyChats = async (req, res) => {
  try {
    const { userId } = req.params;

    console.log("Received userId:", userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    const myId = new mongoose.Types.ObjectId(userId);


    // Fetch chat threads grouped by chat partner + bookingId
    const chats = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: myId }, { receiver: myId }]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
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
          _id: {
            chatWith: "$chatWith",
            bookingId: "$bookingId"
          },
          latestMessage: { $first: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.chatWith",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          _id: 0,
          userId: "$_id.chatWith",
          bookingId: "$_id.bookingId",
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
      },
      {
        $sort: { timestamp: -1 }
      }
    ]);

    return res.status(200).json({ success: true, chats });
  } catch (error) {
    console.error("Error fetching grouped chats:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getChatBetweenUsers = async (req, res) => {
  try {
    const { userId1, userId2, bookingId } = req.params;

    console.log("Received userId1:", userId1, "userId2:", userId2, "bookingId:", bookingId);

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId1) || !mongoose.Types.ObjectId.isValid(userId2)) {
      return res.status(400).json({ error: "Invalid user IDs." });
    }

    if (!bookingId || bookingId.length < 4) {
      return res.status(400).json({ error: "Invalid booking ID." });
    }

    const id1 = new mongoose.Types.ObjectId(userId1);
    const id2 = new mongoose.Types.ObjectId(userId2);

    // Fetch messages for this user pair and booking ID
    const chatMessages = await Message.find({
      bookingId: bookingId,
      $or: [
        { sender: id1, receiver: id2 },
        { sender: id2, receiver: id1 }
      ]
    }).sort({ timestamp: 1 }); // ascending by time

    // mark messages as read for the user
    await Message.updateMany(
      {
        bookingId: bookingId,
        receiver: id1,
        sender: id2,
        delivered: false
      },
      { $set: { delivered: true } }
    );

    return res.status(200).json({ success: true, messages: chatMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
