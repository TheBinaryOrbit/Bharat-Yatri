import { User } from "../Model/UserModel.js";
import { Subscription } from '../Model/SubscriptionModel.js'
import { SubscriptionPurchase } from '../Model/SubscriptionPurchaseModel.js'


export const buySubscription = async (req, res) => {
    try {
        const { subscriptionType, subscribedBy } = req.body;

        if (!subscriptionType || !subscribedBy) {
            return res.status(400).json({ message: "subscriptionType and subscribedBy are required" });
        }

        // Fetch subscription
        const subscription = await Subscription.findById(subscriptionType);
        if (!subscription) {
            return res.status(404).json({ message: "Subscription type not found" });
        }

        const user = await User.findByIdAndUpdate(
            subscribedBy,
            { $set: { isSubscribed: true } },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + subscription.timePeriod);

        const newPurchase = new SubscriptionPurchase({
            subscriptionType,
            subscribedBy,
            startDate,
            endDate
        });

        await newPurchase.save();

        return res.status(201).json({
            message: "Subscription purchased successfully",
            data: newPurchase
        });

    } catch (error) {
        console.error("Error buying subscription:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};


