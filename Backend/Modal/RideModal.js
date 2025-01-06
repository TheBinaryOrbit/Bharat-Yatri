import mongoose from "mongoose";

const rideSchema = new mongoose.Schema({
    carModal : {
        type : String,
        required : true,
    },
    from : {
        type : String,
        required : true,
    },
    to : {
        type : String,
        required : true,
    },
    description : {
        type : String,
        required : true,
    },
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'user',
    }
},{timestamps : true})


export const ride = mongoose.model('ride' , rideSchema);