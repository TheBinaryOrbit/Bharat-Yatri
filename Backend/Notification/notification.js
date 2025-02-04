import { firebaseadmin } from "../Firebase/firebase.js";
import { user } from "../Modal/UserModals.js";


export const sendnotification = async (location, notification , createdBy) => {
    const userarray =await getUserByLocation(location , createdBy)
    // console.log(userarray)
    // const userarray = ["ckTbz9wNTfu892rNXDmU5N:APA91bEsMmMqK286zSW_Yvq0LjbRb4K0Ens_CTl9diDV2C2nwLCE3IDt586mlerC_bGz6ErgTD1EwQG_PAgD1p2AvuhxUmTVYnPEDoGA_ThBNxE9xWapbyA"]
    // console.log(notification)
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