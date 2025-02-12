import { firebaseadmin } from "../Firebase/firebase.js";
import { user } from "../Modal/UserModals.js";


export const sendnotification = async (location, notification , createdBy) => {
    
    const userarray = ["fSBFp21hRzC__MfxpHiEfA:APA91bH0PFmOcisABnNnbSe5-qM8erOpuPW0N7MvzEeNsaY_2hPUxJG2regZ-XEccKLRBre8usk7cXjQz8kXwqAk5NwdJk_9Z9TDreO_ywfBI2Pjw1Y2yOc"];

    const message = {
        notification: {
            title: "Hello Rider",
            body: "New Ride added"
        },
        data: {
            message: JSON.stringify({
                carModel: notification.carModel,
                from: notification.from,
                to: notification.to,
                description: notification.description
            })
        },
        tokens: userarray
    };
    try {
        const response = await firebaseadmin.messaging().sendEachForMulticast(message);
        // console.log(response.responses);
        console.log("Message send sucessfully");
        return "message send sucessfully"
    } catch (error) {
        console.log(error)
        return "error in sending notification"
    }
}


const getUserByLocation = async (location , createdBy) => {
    const result = await user.find({ fcmtoken :{ $exists : true , $ne: null}}, { _id: 1, fcmtoken: 1 });

    const userarray = result.filter((data)=>{
        return data._id != createdBy;
    })

    const array = userarray.map((data) => {
        return data.fcmtoken;
    });
    return array;
}