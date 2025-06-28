import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  benefits: {
    type: String,
    required: true,
    trim: true
    // Stored as a single comma-separated string (e.g., "24/7 Support,Priority Access,Free Upgrades")
  }
}, {
  timestamps: true
});

export const Subscription = mongoose.model('subscription', SubscriptionSchema);
