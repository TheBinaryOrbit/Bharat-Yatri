import { user } from "../Modal/UserModals.js";
import axios from "axios";
import { generateToken } from "../AuthToken/jwt.js";

export const GetOtp = async (req, res) => {
    try {
        const apikey = process.env.OTP_API

        const { phoneNumber } = req.body

        if (!phoneNumber) return res.status(400).json({ "error": "Phone number is required" });

        try {
            const response = await axios.get(`https://2factor.in/API/V1/${apikey}/SMS/+91${req.body.phoneNumber}/AUTOGEN3`);

            if (response.status == 200) {
                return res.status(200).json({
                    "message": "OTP Sent Sucessfully",
                    "SessionId": response.data.Details
                });
            }

            return res.status(400).json({ "error": "Bad request" });

        } catch (e) {
            console.log(e);
            return res.status(500).json({ 'error': "OTP server Error" })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ 'error': "Somthing Went Wrong" })
    }
}

export const verifyOtp = async (req, res) => {
    const { phoneNumber, OTP, SessionId } = req.body
    if (!phoneNumber || !OTP || !SessionId) return res.status(400).json({ "error": "All Fields Are Required" });

    try {
        const apikey = process.env.OTP_API
        const response = await axios.get(`https://2factor.in/API/V1/${apikey}/SMS/VERIFY/${SessionId}/${OTP}`);

        if (response.status == 400) return res.status(400).json({ "error": "Invalid OTP" });

        try {
            const result = await user.findOne({ phoneNumber: phoneNumber });

            if (!result) return res.status(404).json({ "error": "User Not Register" })

            const token = generateToken(result.phoneNumber, result.id);
            return res.status(200).json({
                id: result._id,
                name: result.name,
                phoneNumber: result.phoneNumber,
                token: token,
                userType : result.userType
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


export const handleAddAgent = async (req, res) => {
    try {
        const { name, agencyName, phoneNumber, email, aadhaarNumber, dlNumber, pincode, address, state, city } = req.body
        if (!name || !agencyName || !phoneNumber || !email || !aadhaarNumber || !dlNumber || !pincode || !address || !state || !city) return res.status(400).json({ "error": "All fields are required" });

        const result = await user.create({ name, agencyName, phoneNumber, email, aadhaarNumber, dlNumber, pincode, address, state, city , userType : 'AGENT' });
        if (!result) return res.status(500).json({ "error": "Error  in creating User" });

        const token = generateToken(result.phoneNumber, result._id);
        return res.status(201).json({
            message: "Agent Account Created sucessfully",
            token: token,
            id: result._id,
            phoneNumber: result.phoneNumber,
            name: result.name,
            userType : result.userType
        })
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "error": "Error in creating account" })
    }
}

export const handleAddRider = async (req, res) => {
    try {
        const { name, email,phoneNumber, aadhaarNumber, dlNumber, dob } = req.body
        if (!name || !email || !phoneNumber || !dob || !aadhaarNumber || !dlNumber) return res.status(400).json({ "error": "All fields are required" });

        const result = await user.create({ name,email, phoneNumber, aadhaarNumber, dlNumber, dob , userType : 'RIDER' });
        if (!result) return res.status(500).json({ "error": "Error in creating User" });

        const token = generateToken(result.phoneNumber, result._id);
        return res.status(201).json({
            message: "Rider Account Created sucessfully",
            token: token,
            id: result._id,
            phoneNumber: result.phoneNumber,
            name: result.name,
            userType : result.userType
        })
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "error": "Error in creating account" })
    }
}

