import { firebaseadmin } from "../Firebase/firebase.js";
import { User } from "../Model/UserModel.js";


export const sendnotification = async (vehicleType, notification , bookedBy) => {


    const userarray = await getUserByvehicleType(vehicleType , bookedBy);

    console.log("User array:", userarray);
    if (userarray.length === 0) {
        console.log("No users found for this vehicle type.");
        return "No users found for this vehicle type.";
    }

    
    const message = {
        notification: {
            title: "Hello Rider",
            body: `New ${vehicleType} ride added`
        },
        data: {
            message: JSON.stringify({
                carModel: vehicleType,
                from: notification.pickUpLocation,
                to: notification.dropLocation,
            })
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


const getUserByvehicleType = async (vehicleType, bookedBy) => {
  try {
    const vehicleTypeUpper = String(vehicleType).toUpperCase().trim();

    console.log(`Searching for vehicle type: ${vehicleTypeUpper}, excluding user: ${bookedBy}`);

    // Step 1: Get all users eligible for notifications
    const users = await User.find(
      {
        isSendNotification: true,
        fcmToken: { $exists: true, $ne: null } // ✅ correct field name
      },
      { _id: 1, fcmToken: 1, carAleartFor: 1 } // ✅ correct projection
    ).lean();

    // Step 2: Filter by car alert and exclude bookedBy
    const filtered = users.filter(user => {
      const carTypes = (user.carAleartFor || []).map(type => String(type).toUpperCase().trim());
      return carTypes.includes(vehicleTypeUpper) && String(user._id) !== String(bookedBy);
    });

    // Step 3: Extract FCM tokens
    const fcmTokens = filtered.map(user => user.fcmToken);

    console.log(`Found ${fcmTokens.length} FCM tokens`);
    return fcmTokens;
  } catch (error) {
    console.error('Error in getUserByvehicleType:', error);
    return [];
  }
};


