import mongoose from "mongoose";

const rideSchema = new mongoose.Schema({
    carModel : {
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
        default : "NO Description"
    },
    PickupDateAndTime : {
        type : String,     
    },
    customerFare : {
        type : String,
    },
    commissionFee : {
        type : String,
        default : "Not mentioned"
    },
    tripType : {
        type : String,
        enum : ['One-Way' , 'Round-Trip']
    },
    rideType : {
        type :String,
        required : true,
        enum : ['Duty' , 'Exchange' , 'Available']
    },
    createdBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'user',
    },
    status : {
        type : String,
        enum : [ 'Completed' , 'Pending'],
        default : 'Pending'
    },
    carrier : {
        type : String,
        enum : ['With Carrier' , 'Without Carrier' , "Not Mentioned"],
        default : "Not Mentioned",
    },
},{timestamps : true});


export const ride = mongoose.model('ride' , rideSchema);