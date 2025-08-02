import { firebaseadmin } from "../Firebase/firebase.js";
import { User } from "../Model/UserModel.js";


export const sendStatusNotification = async (userarray , bookinId , status) => {

    console.log("Sending notification to users:", userarray, "for booking ID:", bookinId, "with status:", status);
    const message = {
        notification: {
            title: `Booking Status Update for ${bookinId}`,
            body: `Your booking ${bookinId} has been updated to  Status : ${status}.`
        },
        tokens: userarray
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
