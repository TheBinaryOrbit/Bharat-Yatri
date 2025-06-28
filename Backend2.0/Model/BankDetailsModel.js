import mongoose from "mongoose";

const bankDetailsSchema = new mongoose.Schema({
  accountHolderName: {
    type: String,
    required: true,
    trim: true,
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  ifscCode: {
    type: String,
    required: true,
    uppercase: true,
    match: [/^[A-Z]{4}0[A-Z0-9]{6}$/ , "Enter a valid IFSC code"], // Validates IFSC format
  },
  bankName: {
    type: String,
    required: true,
    trim: true,
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

export const BankDetails = mongoose.model('BankDetails', bankDetailsSchema);
