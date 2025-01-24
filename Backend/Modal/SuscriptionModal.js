import mongoose from "mongoose";

const suscriptionSchema = new mongoose.Schema({
    suscriptionType : {
        type : String,
        required : true
    },
    price : {
        type : String,
        required : true
    },
    description : {
        type : String,
        required : true
    },
    benefits :[
        {
            type : String,
            required : true
        }
    ],
    timePeriod : {
        type : Number,
        required : true 
    }
});


export const suscription = mongoose.model('suscription' , suscriptionSchema);