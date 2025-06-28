import mongoose from "mongoose";

const SubscriptionPurchaseSchema = new mongoose.Schema({
  subscriptionType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'subscription',
    required: true
  },
  subscribedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function (value) {
        return value > this.startDate;
      },
      message: "End date must be after start date"
    }
  }
}, {
  timestamps: true
});

export const SubscriptionPurchase = mongoose.model('subscriptionpurchase', SubscriptionPurchaseSchema);
