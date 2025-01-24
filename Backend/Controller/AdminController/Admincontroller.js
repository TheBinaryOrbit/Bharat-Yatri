import { user } from "../../Modal/UserModals.js";

export const getAllRides=async (req,res)=>{
    try{
        const result =  await user.find({userType : 'RIDER'})

        if(result.length == 0) return res.status(204).json({"Message" : "No Rides" });

        return res.status(200).json(result)
    }catch{
        console.log(e)
        return res.status(500).json({"error" : "Something Went Wrong"})
    }
}

export const getAllAgents=async (req,res)=>{
    try{
        const result =  await user.find({userType : 'AGENT'})

        if(result.length == 0) return res.status(204).json({"Message" : "No Rides" } , {});

        return res.status(200).json(result)
    }catch{
        console.log(e)
        return res.status(500).json({"error" : "Something Went Wrong"})
    }
}

export const Verifyuser=async (req,res)=>{
    try{
        const id = req.params.id 
        const result =  await user.findByIdAndUpdate(id , {$set : { isVerified : true }})

        if(!result) return res.status(404).json({"error" : "User Not Found"});
        return res.status(200).json({"Message" : "User Verified Sucessfully"});
    }catch(e){
        console.log(e)
        return res.status(500).json({"error" : "Unable to Verify User"})
    }
}