// sendChatNotification.js
import { firebaseadmin } from "../Firebase/firebase.js";
import { User } from "../Model/UserModel.js";

/**
 * Send a chat push that opens the receiver's ChatDetail screen on tap.
 *
 * @param {Object} args
 * @param {string} args.senderId       - The sender's user _id (this becomes otherUserId for the receiver)
 * @param {string} args.senderName     - The sender's display name (for title and otherUserName)
 * @param {string} args.receiverId     - The receiver's user _id (whose device(s) get the push)
 * @param {string} args.content        - Message preview text (notification body)
 * @param {string|number} args.bookingId - Booking id required by your ChatDetailScreen
 */
export const sendChatNotification = async ({
  senderName,
  receiverId,
  content,
  senderId,
  bookingId,
}) => {
  // 1) Fetch receiver's FCM token(s)
  const user = await User.findById(receiverId).select("fcmToken");
  if (!user) {
    console.log("⚠️ Receiver not found:", receiverId);
    return "receiver not found";
  }

  // Normalize tokens: accept string or array in DB
  let tokens = [];
  if (Array.isArray(user.fcmToken)) {
    tokens = user.fcmToken.filter(Boolean);
  } else if (typeof user.fcmToken === "string" && user.fcmToken.trim()) {
    tokens = [user.fcmToken.trim()];
  }

  console.log("📨 Tokens:", tokens);

  if (!tokens.length) {
    console.log("⚠️ No FCM tokens for receiver:", receiverId);
    return "no fcm tokens";
  }

  // 2) Build the message
  //    IMPORTANT: Every value inside `data` MUST be a STRING.
  const message = {
    notification: {
      title: String(senderName ?? "New message"),
      body: String(content ?? "Tap to open chat"),
    },
    data: {
      action: "open_chat",
      bookingId: String(bookingId ?? ""),      // required by your app
      otherUserId: String(senderId ?? ""),     // the chat peer for the receiver
      otherUserName: String(senderName ?? ""), // optional (nice for AppBar)
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
    tokens,
    android: {
      priority: "high",
      notification: {
        channelId: "chat_channel",
        sound: "default",
      },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: {
        aps: {
          sound: "default",
          contentAvailable: true,
          mutableContent: true,
        },
      },
    },
  };

  // 3) Send
  try {
    const response = await firebaseadmin.messaging().sendEachForMulticast(message);
    console.log("✅ Chat notification sent:", {
      successCount: response.successCount,
      failureCount: response.failureCount,
      // errors: response.responses?.filter(r => !r.success).map(r => r.error?.message)
    });
    return "message sent";
  } catch (error) {
    console.error("❌ FCM send error:", error);
    return "error in sending notification";
  }
};
