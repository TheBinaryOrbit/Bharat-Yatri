import { user } from "../../Modal/UserModals.js";

export const handleUploadAadhar = async (req , res)=>{
    try {
        const id = req.params.id;

        if(id.length != 24 ) return res.status(400).json({"error":"Id must be of 24 digit"});

        const result = await  user.findByIdAndUpdate( id, {aadhaarPhoto : {
            imageUrl : `aadhar/${req.file.filename}`,
        }} , {new : true});

        if(!result) return res.status(404).json({"error":"user not found"});

        return res.status(200).json({"message":"aadhar uploded sucessfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({"error":"internal server error"});
    }
}


export const handleUploadPan = async (req , res)=>{
    try {
        const id = req.params.id;

        if(id.length != 24 ) return res.status(400).json({"error":"Id must be of 24 digit"});

        const result = await  user.findByIdAndUpdate( id, { dlPhoto : {
            imageUrl : `dl/${req.file.filename}`
        }} , {new : true});

        if(!result) return res.status(404).json({"error":"user not found"});

        return res.status(200).json({"message":"dl uploded sucessfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({"error":"internal server error"});
    } 
}


export const handleUploadPhoto = async (req , res)=>{
    try {
        const id = req.params.id;

        if(id.length != 24 ) return res.status(400).json({"error":"Id must be of 24 digit"});

        const result = await  user.findByIdAndUpdate( id, { profilePhoto : {
            imageUrl : `profile/${req.file.filename}`
        }} , {new : true});

        if(!result) return res.status(404).json({"error":"user not found"});

        return res.status(200).json({"message":"Profile Photo uploded sucessfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({"error":"internal server error"});
    } 
}


export const handleUploadNumberPlate = async (req , res)=>{
    try {
        const id = req.params.id;

        if(id.length != 24 ) return res.status(400).json({"error":"Id must be of 24 digit"});

        const result = await  user.findByIdAndUpdate( id, { NumberPlate : {
            imageUrl : `numberplate/${req.file.filename}`
        }} , {new : true});

        if(!result) return res.status(404).json({"error":"user not found"});

        return res.status(200).json({"message":"NumberPlate uploded sucessfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({"error":"internal server error"});
    } 
}