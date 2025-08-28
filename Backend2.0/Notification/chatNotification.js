import { firebaseadmin } from "../Firebase/firebase.js";
import { User } from "../Model/UserModel.js";

export const sendChatNotification = async (senderName, reciver, content) => {

    const token = await User.findById(reciver).select("fcmToken");
    console.log("Token:", token);

    const tokenArray = token.fcmToken;
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
        tokens: [tokenArray],
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
    try {
        const response = await firebaseadmin.messaging().sendEachForMulticast(message);
        console.log("Message send sucessfully");
        return "message send sucessfully"
    } catch (error) {
        console.log(error)
        return "error in sending notification"
    }
}