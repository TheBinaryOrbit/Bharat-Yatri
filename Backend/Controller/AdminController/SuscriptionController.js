import { suscription } from "../../Modal/SuscriptionModal";

export const addSuscription = async (req,res)=>{
    try {
        const { suscriptionType , price  , description , benefits , timePeriod} = req.body;
 
        if(!suscriptionType || !price || !description || !benefits || !timePeriod) return res.status(400).json({"error"  : "All fields are required"});

        const result = await suscription.create(req.body);

        if(!result) return res.status(400).json({"error" : "Somthing wnet wrong"});
        res.status(201).json({"message"  : "Suscription Added Sucessfully" ,  ...result})
    } catch (error) {
        console.log(error);
        return res.status(500).json({"error" : "Somthing wnet wrong"});
    }
}

export const updateSuscription =async (req,res) =>{
    try {
        const id =  req.params.id;
        if(req.body.length = 0) return res.status(400).json({"error" : "Field to be updated are required"});

        const result =  await suscription.findByIdAndUpdate(id  , req.body , {new : true});
        if(!result) return res.status(404).json({"error" : "Suscription model not found"});

        res.status(200).json({"message"  : "Suscription Updated Sucessfully" ,  ...result})
    } catch (error) {
        console.log(error);
        res.status(500).json({"error" : "Internal server error"});
    }
}

export const deleteSuscription = async (req,res) =>{
    try {
        const id =  req.params.id;

        if(id.length) return res.status(400).json({"error" : "Id must be of 24 digit"});

        const result = await suscription.findByIdAndDelete(id);

        if(!result) return res.status(404).json({"error" : "Suscription model not found"});

        res.status(200).json({"message"  : "Suscription Deleted Sucessfully"});
    } catch (error) {
        console.log(error);
        res.status(500).json({"error" : "Unable to Internal server error"});
    }
}