import { ride } from "../Modal/RideModal.js";

export const addride = async (req, res) => {
    try {
        const { carModal, from, to, description, createdBy } = req.body;
        if (!carModal || !from || !to || !description || !createdBy) return res.status(400).json({ "error": "All Fields Are required" });

        const result = await ride.create({ carModal, from, to, description, createdBy });
        if (!result) return res.status(400).json({ "error": "Something Went Wrong" });

        return res.status(201).json({ "message": "Ride Added Sucessfully" });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "error": "Something Went Wrong" });
    }
}

export const getAllrides = async (req, res) => {
    try {
        const result = await ride.find({}).populate('createdBy', { 'name': 1, 'phoneNumber': 1, 'email': 1 });

        if (!result) return res.status(500).json({ "error": "Error in Getting Rides" });
        return res.status(200).json(result);
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting Rides" });
    }
}


export const getOwnrides = async (req, res) => {
    try {
        const result = await ride.find({ createdBy: req.params.id });
        if (!result) return res.status(500).json({ "error": "Error in Getting Rides" });
        return res.status(200).json(result);
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting Rides" });
    }
}