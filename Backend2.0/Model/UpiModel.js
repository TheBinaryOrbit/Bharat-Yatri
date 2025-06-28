import mongoose from "mongoose";

const upiDetailsSchema = new mongoose.Schema({
    upiId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^[\w.-]+@[\w.-]+$/, "Please enter a valid UPI ID"],
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        unique : true
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

export const upidetails = mongoose.model('upidetails', upiDetailsSchema);


