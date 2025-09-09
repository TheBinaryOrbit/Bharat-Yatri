import { User } from "../Model/UserModel.js";
import { sendOTP, verifyOTPWithPhoneNumber } from "../utils/OTP.js";
import { Vehicle } from '../Model/VehicleModel.js'
import { Driver } from '../Model/DriverModel.js'
import { uploadUserFiles } from "../Storage/UserStorage.js";
import { SubscriptionPurchase } from '../Model/SubscriptionPurchaseModel.js';
import TravelAgency  from '../Model/TravelAgencyModel.js'

// Send OTP Controller
export const GetOTP = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        console.log("Get OTP :" + phoneNumber);
        if (!phoneNumber) {
            return res.status(400).json({ error: "Phone number is required." });
        }

        const OTPStatus = await sendOTP(phoneNumber);

        console.log("OTP Status:", OTPStatus); 

        if (!OTPStatus.status) {
            return res.status(503).json({ error: "Failed to send OTP. Service unavailable." });
        }

        return res.status(200).json({
            message: "OTP sent successfully.",
            sessionId: OTPStatus.sessionId || "mock-session-id", // Replace with real sessionId if using a service
        });
    } catch (error) {
        console.error("GetOTP Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// Verify OTP Controller
export const verifyOTP = async (req, res) => {
    try {
        const { phoneNumber, OTP, sessionId, fcmToken } = req.body;

        console.log(fcmToken);

        if (!phoneNumber || !OTP || !sessionId) {
            return res.status(400).json({ error: "All fields are required: phoneNumber, OTP, and sessionId." });
        }

        // console.log(phoneNumber);
        const OTPStatus = await verifyOTPWithPhoneNumber(phoneNumber, OTP, sessionId);

        if (!OTPStatus) {
            return res.status(400).json({ error: "Invalid or expired OTP." });
        }

        const user = await User.findOne({ phoneNumber });

        console.log(user);

        if (!user) {
            return res.status(200).json({
                message: "OTP verified successfully, but user not found.",
                userStatus: 404,
            });
        }

        
        await User.findOneAndUpdate(
            { phoneNumber: phoneNumber },
            {
                $set: {
                    fcmToken: fcmToken
                }
            },
            { new: true, runValidators: true }
        )

        console.log("User found:", user);
        console.log("FCM Token:", user.fcmToken);

        return res.status(200).json({
            message: "OTP verified successfully.",
            userStatus: 200,
            user: {
                id: user._id,
                name: user.name,
                phoneNumber: user.phoneNumber,
                fcmToken: user.fcmToken,
            }
        });
    } catch (error) {
        console.error("verifyOTP Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// creating a new user if user not exist
export const createUser = async (req, res) => {
    try {
        const { name, phoneNumber, city } = req.body;

        if (!name || !phoneNumber || !city) {
            return res.status(400).json({ error: "All fields (name, phoneNumber, city) are required." });
        }

        // Second check - just before creating (race condition safety)
        const userExistsBeforeCreate = await User.findOne({ phoneNumber });
        if (userExistsBeforeCreate) {
            return res.status(409).json({ error: "Phone number already registered (retry check)." });
        }

        const newUser = await User.create({ name, phoneNumber, city });

        return res.status(201).json({
            message: "User created successfully.",
            user: {
                id: newUser._id,
                name: newUser.name,
                phoneNumber: newUser.phoneNumber,
                city: newUser.city,
            }
        });
    } catch (error) {
        console.error("CreateUser Error:", error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }

        // Catch duplicate key error from MongoDB in case two parallel requests slip past checks
        if (error.code === 11000 && error.keyValue?.phoneNumber) {
            return res.status(409).json({ error: "Phone number already registered" });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// update user whole user "PUT"
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            phoneNumber,
            city,
            email,
            companyName,
            userType,
            aadharNumber,
            drivingLicenceNumber
        } = req.body;

        // Validate required fields 
        if (!id) {
            return res.status(400).json({ error: "User ID is required in URL parameter." });
        }

        // Prepare update object
        const updateData = {};
        if (name) updateData.name = name;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (city) updateData.city = city;
        if (email) updateData.email = email;
        if (companyName) updateData.companyName = companyName;
        if (userType) updateData.userType = userType;
        if (aadharNumber) updateData.aadharNumber = aadharNumber;
        if (drivingLicenceNumber) updateData.drivingLicenceNumber = drivingLicenceNumber;


        console.log(updateData);

        const updatedUser = await User.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found." });
        }

        return res.status(200).json({
            message: "User updated successfully.",
            user: updatedUser,
        });

    } catch (error) {
        console.error("Update User Error:", error);

        // Handle duplicate key errors
        if (error.code === 11000) {
            const duplicatedField = Object.keys(error.keyValue)[0];
            return res.status(409).json({
                error: `Duplicate value for ${duplicatedField}: ${error.keyValue[duplicatedField]}`
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({ error: error.message });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// get user 
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: "User ID is required." });
        }

        let user = await User.findById(id).lean(); // `lean()` returns a plain JS object


        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // check purshaed subscription that user has a valid subscription
        const currentDate = new Date();
        const subscription = await SubscriptionPurchase.findOne({
            subscribedBy: id,
            endDate: { $gte: currentDate } // Check if subscription is still valid
        });


        // is user is not subscribed or subscription is expired
        if (!subscription) {
            //update user isSubscribed to false
            console.log("User is not subscribed or subscription expired, updating user status.");
            user = await User.findByIdAndUpdate(id, { isSubscribed: false } , { new: true });
        }

        return res.status(200).json({
            message: "User fetched successfully.",
            user,
        });
    } catch (error) {
        console.error("GetUser Error:", error);

        if (error.kind === 'ObjectId') {
            return res.status(400).json({ error: "Invalid user ID." });
        }

        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// on aleart
export const onUserAlerts = async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicles, cityAlertFor } = req.body;

        console.log("Received data:", req.body);
        if (!id) {
            return res.status(400).json({ error: "ID is required." });
        }

        

        // cityAlertFor to null if empty
        const city = cityAlertFor?.trim() || null;

        const uppercaseVehicles = vehicles.map(vehicle => String(vehicle).trim().toUpperCase());

        const updatedUser = await User.findOneAndUpdate(
            { _id: id },
            {
                $set: {
                    carAleartFor: uppercaseVehicles,
                    cityAlertFor: city,
                    isSendNotification: true,
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found with this phone number." });
        }

        console.log("Updated User:", updatedUser);

        return res.status(200).json({
            message: "User alert preferences updated successfully.",
            user: updatedUser
        });

    } catch (error) {
        console.error("Update Alerts Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

// off aleart 
export const offUserAlerts = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedUser = await User.findOneAndUpdate(
            { _id: id },
            {
                $set: {
                    isSendNotification: false,
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: "User not found with this phone number." });
        }

        return res.status(200).json({
            message: "User alert preferences updated successfully.",
            user: updatedUser
        });

    } catch (error) {
        console.error("Update Alerts Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export const checkUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        const [vehicleCount, driverCount] = await Promise.all([
            Vehicle.countDocuments({ userId: id }),
            Driver.countDocuments({ userId: id })
        ]);

        const travelAgency = await TravelAgency.findOne({ userId: id }).lean();

        const responseData = {
            isPorfileCompleted : true,
            isVehicleAdded : true,
            isDriverAdded : true,
            isTravelAgencyCompleted : true,
            isFreeTrialEligible: user.isFreeTrialEligible
        }

        if(!user.name || !user.phoneNumber || !user.city || !user.email || !user.companyName || !user.userType || !user.aadharNumber || !user.drivingLicenceNumber){
            responseData.isPorfileCompleted == false
        }

        if(vehicleCount == 0){
            responseData.isVehicleAdded = false
        }

        if(driverCount == 0){
            responseData.isDriverAdded = false
        }

        // Check travel agency completeness
        if (!travelAgency ||
            !travelAgency.travelAgencyName ||
            !travelAgency.contactPersonName ||
            !travelAgency.mobileNumber ||
            !travelAgency.city) {
            responseData.isTravelAgencyCompleted = false;
        }

        return res.status(200).json({
            message : "User Checked Sucessfully",
            responseData
        });
    } catch (error) {
        console.error("Update Alerts Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


export const uploadUserPhoto = async(req, res) => {
    try {
        uploadUserFiles(req, res, async (err) => {
            if (err) {
                console.error("File upload error:", err);
                return res.status(400).json({ error: "File upload failed." });
            }

            if (!req.files || !req.files.userImage || req.files.userImage.length === 0) {
                return res.status(400).json({ error: "No user image uploaded." });
            }

            const userId = req.params.id;
            const userImagePath = `/userimages/${req.files.userImage[0].filename}`;

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { userImage: userImagePath },
                { new: true, runValidators: true }
            );

            if (!updatedUser) {
                return res.status(404).json({ error: "User not found." });
            }

            return res.status(200).json({
                message: "User image uploaded successfully.",
                user: updatedUser
            });
        });
    } catch (error) {
        console.error("Upload User Photo Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}