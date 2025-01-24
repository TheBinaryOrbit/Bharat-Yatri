
import { json } from "express";
import { firebaseadmin } from "../Firebase/firebase.js";
import { user } from "../Modal/UserModals.js";


export const sendnotification = async (location, notification) => {
    // const userarray = getUserByLocation(location)
    const userarray = ["ckTbz9wNTfu892rNXDmU5N:APA91bEsMmMqK286zSW_Yvq0LjbRb4K0Ens_CTl9diDV2C2nwLCE3IDt586mlerC_bGz6ErgTD1EwQG_PAgD1p2AvuhxUmTVYnPEDoGA_ThBNxE9xWapbyA"]
    const message = {
        notification: {
            title: "new ride",
            body: "hello from backend"
        },
        data: {
            message: JSON.stringify({
                carModel: "sedan",
                from: "ghaziabad",
                to: "ranchi",
                description: "notification gaya??"
            })
        },
        tokens: userarray
    };
    // return
    try {
        const response = await firebaseadmin.messaging().sendEachForMulticast(message);
        console.log(response.responses);
        return "message send sucessfully"
    } catch (error) {
        console.log(error)
        return "error in sending notification"
    }
}


const getUserByLocation = async (location) => {
    const result = await user.find({}, { _id: 1, fcmtoken: 1 });
    const userarray = result.map((data) => {
        return data.fcmtoken
    })
    return userarray;
}