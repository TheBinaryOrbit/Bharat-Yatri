import { firebaseadmin } from "../Firebase/firebase.js";
import { User } from "../Model/UserModel.js";

export const sendChatNotification = async (senderName , reciver , content) => {

    const token = await User.findById(reciver).select("fcmToken");
    console.log("Token:", token);

    const tokenArray = token.fcmToken;
    const message = {
        notification: {
            title: senderName,
            body: content
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