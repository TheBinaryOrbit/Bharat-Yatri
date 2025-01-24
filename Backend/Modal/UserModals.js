import mongoose from "mongoose";

// creating the schema with field name , phonenumber , aadhaar number , driving licence number , verified or not

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    aadhaarPhoto : {
        type : String,
    },
    dlPhoto : {
        type : String,
    },
    aadhaarNumber: {
        type: String,
        unique: true,
        required: true
    },
    dlNumber: {
        type: String,
        unique: true,
        required: true
    },
    userType: {
        type: String,
        required: true,
        enum: ['ADMIN', 'RIDER', 'AGENT']
    },
    isVerified: {
        type: Boolean,
        required: true,
        default: false
    },
    suscriptionType: {
       type : mongoose.Schema.Types.ObjectId,
       ref : 'suscription'
    },
    isSubscribed : {
        type : Boolean,
        default : false
    },
    suscriptionStaredDate : {
        type : Date,
        default : Date.now
    },
    suscriptionEndDate : {
        type : Date,
        default : Date.now
    },
    freeTrailEliglibity: {
        type: Boolean,
        default: true
    },
    agencyName: {
        type: String,
    },
    pincode: {
        type: String,

    },
    address: {
        type: String,

    },
    state: {
        type: String,

    },
    city: {
        type: String,
    },
    dob : {
        type: String,
    },
    userCurrentLocation : {
        type : String,
        default : 'delhi'
    },
    fcmtoken : {
        type :  String,
    }
}, { timestamps: true });



export const user = mongoose.model('user' , userSchema)