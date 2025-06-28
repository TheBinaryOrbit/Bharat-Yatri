import mongoose from "mongoose";

export const Connectdatabase = (URL)=>{
    mongoose.connect(URL)
    .then(()=>{
        console.log("Database Connected Sucessfully");
    })
    .catch((e)=>{
        console.log("Error in Connecting Database");
        console.log(e)
    })
}