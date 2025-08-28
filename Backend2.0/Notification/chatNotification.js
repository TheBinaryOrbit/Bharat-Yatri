import { firebaseadmin } from "../Firebase/firebase.js";
import { User } from "../Model/UserModel.js";

export const sendChatNotification = async (senderName, reciver, content) => {

    const token = await User.findById(reciver).select("fcmToken");
    console.log("Token:", token);

    const tokenArray = token.fcmToken;
    const message = {
        notification: {
            title: senderName,
            body: content
        },
        data: {
            action: "open_chat",
            bookingId: String(reciver ?? ""),      // required by your app
            otherUserId: String(reciver ?? ""),     // the chat peer for the receiver
            otherUserName: String(reciver ?? ""), // optional (nice for AppBar)
            click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
        tokens: [tokenArray],
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