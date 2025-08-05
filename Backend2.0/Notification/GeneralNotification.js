import { firebaseadmin } from "../Firebase/firebase.js";


export const generalNotification = async ({userarray , title , body}) => {

    const message = {
        notification: {
            title: title,
            body: body
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
