import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
    subscriptionType : {
        type : String,
        enum : ['Premium' , 'Standard' , 'Basic' , 'Trial' , 'None'] ,
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


export const subscription = mongoose.model('subscription' , SubscriptionSchema);