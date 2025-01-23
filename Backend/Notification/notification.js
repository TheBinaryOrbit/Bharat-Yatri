import { firebaseadmin } from "../Firebase/firebase.js";
import { user } from "../Modal/UserModals.js";


export const sendnotification = async (location , notification)=>{
    const userarray = ['epS28vu-THOPxjPg6sPX5g:APA91bGZ4mqoV_DJlEkzPeUqq4smgUgw1PAw3_NG2dFmcxWcc9pQwRkMlJG8bZ6W4tlSk51D9lp-qUypiTaQ0PxgX366cYbEwabjI9Tx0suiiRNNp9EM27M']
    const message = {
        notification: {
            title: "New Message",
            body: "Hello from the backend!"
        },
        data: {
            message: "hello"
        },    
        tokens : userarray
    };
    // return
    try {
         const response = await firebaseadmin.messaging().sendEachForMulticast(message);
         console.log(response);
         return "message send sucessfully"
    } catch (error) {
        console.log(error)
        return "error in sending notification"
    }
}


const getUserByLocation = async (location)=>{
    const result = await user.find({userCurrentLocation : location} , { _id : 1 , fcmtoken: 1});
    const userarray = result.map((data)=>{
        return data.phoneNumber
    })
    return userarray;
}