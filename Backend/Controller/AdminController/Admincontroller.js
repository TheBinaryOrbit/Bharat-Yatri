import { user } from "../../Modal/UserModals.js";
import { ride } from "../../Modal/RideModal.js";
import { permission } from "../../Modal/permission.js";
import { generateToken } from "../../AuthToken/jwt.js";
import mongoose from "mongoose";
const ObjectId =  mongoose.Types.ObjectId;


export const getAllUser = async (req, res) => {
    try {
        let result = [];

        // Construct match query
        let matchQuery = {};

        if (req.query.usertype) {
            matchQuery.userType = req.query.usertype;
        }

        if (req.query.options === 'Verified') {
            matchQuery.isVerified = true;
        }

        if (req.query.options === 'UnVerified') {
            matchQuery.isVerified = false;
        }

        if (req.query.name) {
            matchQuery.name = { $regex: req.query.name, $options: 'i' };
        }

        result = await user.aggregate([
            { $match: matchQuery },
            {
                $facet: {
                    metadata: [{ $count: "totalUsers" }], 
                    data: [
                        { $project: { _id: 1, phoneNumber: 1, name: 1, isVerified: 1, isSubscribed: 1, userType: 1 } },
                        { $sort: { createdAt: -1 } },
                        { $skip: (+req.query.page - 1) * (+req.query.limit) },
                        { $limit: +req.query.limit }
                    ]
                }
            }
        ]);

        const users = result[0].data;
        const totalUsers = result[0].metadata.length > 0 ? result[0].metadata[0].totalUsers : 0;

        if (!users) return res.status(500).json({ "error": "Error in Getting Users" });
        return res.status(200).json({
            totalUsers: totalUsers,
            users: users
        });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "error": "Error in Getting User" });
    }
};


export const Verifyuser = async (req, res) => {
    try {
        const id = req.params.id
        const result = await user.findByIdAndUpdate(id, { $set: { isVerified: true } }, { new: true })

        if (!result) return res.status(404).json({ "error": "User Not Found" });
        return res.status(200).json({
            "Message": "User Verified Sucessfully",
            user: result
        });
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Unable to Verify User" })
    }
}


export const handleGetUserByAdmin = async (req, res) => {
    try {
        let result = await user.findOne({ _id: req.params.id }).populate('suscriptionType');
        result = {
            ...result.toObject(),
            suscriptionEndDate: result.suscriptionEndDate.toLocaleDateString(),
            suscriptionStaredDate: result.suscriptionStaredDate.toLocaleDateString()
        }

        if (result.length == 0) return res.status(404).json({ "error": "User Not found" });
        return res.status(200).json(result);
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting user" });
    }
}



export const handleLogin = async (req, res) => {
    const { phoneNumber, OTP, SessionId } = req.body
    if (!phoneNumber || !OTP || !SessionId) return res.status(400).json({ "error": "All Fields Are Required" });
    try {
        const apikey = process.env.OTP_API
        // // const response = await axios.get(`https://2factor.in/API/V1/${apikey}/SMS/VERIFY/${SessionId}/${OTP}`);
        // if (response.status == 400) return res.status(400).json({ "error": "Invalid OTP" });

        if (req.body.OTP != '1234') return res.status(400).json({ "error": "Invalid OTP" });

        try {
            const number = phoneNumber

            const result = await user.findOne({ phoneNumber: number });

            if (result == null) return res.status(404).json({ "error": "User Not Register" });

            if (result.userType != 'ADMIN') return res.status(403).json({ "error": "Not an Admin" });
            const pr = await permission.find({}).sort({ "priority": 1})
            const token = generateToken(result.phoneNumber, result.id, result.userType);
            return res.status(200).json({
                id: result._id,
                email: result.email,
                name: result.name,
                phoneNumber: result.phoneNumber,
                token: token,
                userType: result.userType,
                permission: pr
            })

        } catch (e) {
            console.log(e);
            return res.status(500).json({ "error": "Somting Went Wrong Try After Some Time" });
        }
    } catch (e) {
        console.log(e);
        return res.status(400).json({ 'error': "Invalid OTP" })
    }
}


export const getstats = async (req, res) => {
    try {
        const userStats = await user.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    totalRiders: { $sum: { $cond: [{ $eq: ["$userType", "RIDER"] }, 1, 0] } },
                    totalAgents: { $sum: { $cond: [{ $eq: ["$userType", "AGENT"] }, 1, 0] } },
                    totalVerifiedUsers: { $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] } },
                    premiumUsers: { $sum: { $cond: [{ $eq: ["$suscriptionType", new ObjectId('679c1aaac9d16375aeea4461')] }, 1, 0] } },
                    standardUsers: { $sum: { $cond: [{ $eq: ["$suscriptionType", new ObjectId('679c1ab8c9d16375aeea4463')] }, 1, 0] } },
                    basicUsers: { $sum: { $cond: [{ $eq: ["$suscriptionType", new ObjectId('679c1ac2c9d16375aeea4465')] }, 1, 0] } },
                    trialUsers: { $sum: { $cond: [{ $eq: ["$suscriptionType", new ObjectId('679c1acac9d16375aeea4467')] }, 1, 0] } },
                    noneUsers: { $sum: { $cond: [{ $eq: ["$suscriptionType", new ObjectId('679c1b61c9d16375aeea4469')] }, 1, 0] } }
                }
            }
        ]);

        const {
            totalUsers = 0,
            totalRiders = 0,
            totalAgents = 0,
            totalVerifiedUsers = 0,
            premiumUsers = 0,
            standardUsers = 0,
            basicUsers = 0,
            trialUsers = 0,
            noneUsers = 0
        } = userStats[0] || {};

        const totalSubscriptions = premiumUsers + standardUsers + basicUsers + trialUsers + noneUsers;
        const percentage = (count) => (totalSubscriptions > 0 ? (count / totalSubscriptions * 100).toFixed(2) : 0);

        const rideStats = await ride.aggregate([
            {
                $group: {
                    _id: null,
                    totalRides: { $sum: 1 },
                    totalDutyRides: { $sum: { $cond: [{ $eq: ["$rideType", "Duty"] }, 1, 0] } },
                    totalAvailableRides: { $sum: { $cond: [{ $eq: ["$rideType", "Available"] }, 1, 0] } },
                    totalExchangeRides: { $sum: { $cond: [{ $eq: ["$rideType", "Exchange"] }, 1, 0] } }
                }
            }
        ]);


        const {
            totalRides = 0,
            totalDutyRides = 0,
            totalAvailableRides = 0,
            totalExchangeRides = 0
        } = rideStats[0] || {};

        return res.status(200).json({
            totalUsers,
            totalRiders,
            totalAgents,
            totalVerifiedUsers,
            subscriptionPercentage: {
                premium: percentage(premiumUsers),
                standard: percentage(standardUsers),
                basic: percentage(basicUsers),
                trial: percentage(trialUsers),
                none: percentage(noneUsers)
            },
            totalRides,
            totalDutyRides,
            totalAvailableRides,
            totalExchangeRides
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Something Went Wrong" });
    }
};


