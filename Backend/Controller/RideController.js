import { ride } from "../Modal/RideModal.js";

export const addride = async (req, res) => {
    try {
        console.log(req.body)
        const { carModel, from, to, description, createdBy } = req.body;
        if (!carModel || !from || !to || !description || !createdBy) return res.status(400).json({ "error": "All Fields Are required" });

        const result = await ride.create({ carModel, from, to, description, createdBy });
        if (!result) return res.status(400).json({ "error": "Something Went Wrong" });

        return res.status(201).json({ "message": "Ride Added Sucessfully" });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ "error": "Something Went Wrong" });
    }
}

export const getAllrides = async (req, res) => {
    try {
        let result = await ride.find({}).populate('createdBy', { 'name': 1, 'phoneNumber': 1, 'email': 1 , "userType" : 1 });

        console.log("hello rides")
        result = result.map((ride) => {
            return {
                ...ride.toObject(),
                createdAt : ride.createdAt.toLocaleString(),
                updatedAt : ride.updatedAt.toLocaleString()
            }
        })
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

export const hanldeUpdateRide = async (req,res) =>{
    try{
        const result = await ride.findByIdAndUpdate(req.params.id , req.body);
        if(!result) return res.status(404).json({"error" : "Ride Not Found"} , {new : true});
        return res.status(200).json({"message" : "Ride Updated Sucessfully"});
    }catch(e){
        console.log(e)
        return res.status(500).json({ "error": "Error in Updating Rides" });
    }
}


export const hanldeDeleteRide = async (req,res) =>{
    try{
        const result = await ride.findByIdAndDelete(req.params.id);
        if(!result) return res.status(404).json({"error" : "Ride Not Found"});
        return res.status(200).json({"message" : "Ride Deleted Sucessfully"});
    }catch(e){
        console.log(e)
        return res.status(500).json({ "error": "Error in Deleting Rides" });
    }
}


