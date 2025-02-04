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
        required : true,
    },
    PickupDateAndTime : {
        type : String,     
    },
    customerFare : {
        type : String,
    },
    commissionFee : {
        type : String,
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
    }
},{timestamps : true})


export const ride = mongoose.model('ride' , rideSchema);