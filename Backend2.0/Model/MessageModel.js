import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  delivered: { type: Boolean, default: false },  // <-- Add this
  images: [{ type: String }]
});


export const Message = mongoose.model('message' , messageSchema)
