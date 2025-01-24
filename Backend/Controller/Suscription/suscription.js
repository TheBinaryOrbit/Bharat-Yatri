import { suscription } from "../../Modal/SuscriptionModal.js";
import { user } from "../../Modal/UserModals.js";


export const handleBuySuscription =async (req,res)=>{
    try {
        console.log(req.body);
        const { suscriptionId , UserId} = req.body;

        // wrong parameters and invalid body
        if(!suscriptionId || !UserId ) return res.status(400).json({"error" : "All fields are required"});
        if(suscriptionId.length !== 24) return res.status(400).json({"error" : "Wrong Suscription Id"});
        if(UserId.length !== 24) return res.status(400).json({"error" : "Wrong user Id"});

        // const Suscriptiondetails = await suscription.findOne({_id : suscriptionId});

        // const result =await user.findByIdAndUpdate(UserId , {$set : {isSubscribed : true , time : Suscriptiondetails.time}} , {new : true});


        const result = await user.findByIdAndUpdate({_id : UserId} , {
            $set : {
                isSubscribed : true,
            }
        })
        
        console.log(result);
        res.json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({"error" : "internonal server error"})
    }
}