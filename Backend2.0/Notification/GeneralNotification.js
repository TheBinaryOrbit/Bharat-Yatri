import { firebaseadmin } from "../Firebase/firebase.js";

export const generalNotification = async ({ userarray, title, body, data }) => {

    const stringifiedData = {};

    // ❌ Reserved keys in FCM
    const reservedKeys = ["from", "notification", "message_type", "collapse_key"];

    if (data) {
        Object.keys(data).forEach(key => {

            let safeKey = key;

            // 🔥 Fix reserved keys automatically
            if (reservedKeys.includes(key)) {
                safeKey = `custom_${key}`;  // rename key
            }

            stringifiedData[safeKey] = String(data[key] ?? '');
        });
    }

    const message = {
        notification: {   // ✅ ADD THIS (better for foreground/background)
            title: title,
            body: body
        },
        data: {
            ...stringifiedData
        },
        android: {
            priority: 'high',
            ttl: 3600 * 1000,
        },
        tokens: userarray
    };

    console.log('FCM Payload:', JSON.stringify(message, null, 2));

    try {
        const response = await firebaseadmin.messaging().sendEachForMulticast(message);

        console.log("Success count:", response.successCount);
        console.log("Failure count:", response.failureCount);

        response.responses.forEach((resp, i) => {
            if (!resp.success) {
                console.log(`Token ${i} failed:`, resp.error?.code, resp.error?.message);
            }
        });

        return "message sent successfully";
    } catch (error) {
        console.log("FCM Error:", error);
        return "error in sending notification";
    }
}