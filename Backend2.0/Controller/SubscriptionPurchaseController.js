import { User } from "../Model/UserModel.js";
import { Subscription } from '../Model/SubscriptionModel.js'
import { SubscriptionPurchase } from '../Model/SubscriptionPurchaseModel.js'
import Razorpay from "razorpay";
import crypto from 'crypto';

const razorpay = new Razorpay({
    key_id: process.env.key_id,
    key_secret: process.env.key_secret,
});

export const createOrder = async (req, res) => {
    const { amount, currency = 'INR', receipt = 'receipt#1' } = req.body;

    try {
        const order = await razorpay.orders.create({
            amount,
            currency,
            receipt,
        });

        console.log(order)

        return res.status(200).json(order);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: 'Failed to create order', details: err });
    }
}


export const buySubscription = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            subscribedBy,
            subscriptionType
        } = req.body;

        console.log("🔔 Request received to buy subscription");
        console.log("📦 Request body:", req.body);

        // Input validation
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !subscribedBy || !subscriptionType) {
            console.warn("⚠️ Missing required fields");
            return res.status(400).json({ message: "All payment and subscription details are required" });
        }



        if (razorpay_order_id === "free-trial'" && razorpay_payment_id === "free-trial'" && razorpay_signature === "free-trial") {
            console.log("🆓 Free trial subscription requested");

            const user = await User.findById(subscribedBy);

            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            if (!user.isFreeTrialEligible) {
                return res.status(403).json({ message: "User is not eligible for free trial" });
            }

            const subscription = await Subscription.findById(subscriptionType);
            if (!subscription) {
                return res.status(404).json({ message: "Subscription type not found" });
            }


            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + subscription.timePeriod);


            const newPurchase = new SubscriptionPurchase({
                subscriptionType,
                subscribedBy,
                startDate,
                endDate,
                razorpay_order_id,
                razorpay_payment_id
            });


            await newPurchase.save();
            console.log("💾 New purchase saved:", newPurchase);

            return res.status(201).json({
                message: "Subscription purchased and verified successfully",
                data: newPurchase
            });
        }

        // Razorpay secret
        const secret = process.env.key_secret;
        console.log("🔐 Razorpay Secret Loaded");

        // Signature verification
        const generatedSignature = crypto.createHmac('sha256', secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        console.log("🔑 Generated Signature:", generatedSignature);
        console.log("🖋️ Received Signature:", razorpay_signature);

        if (generatedSignature !== razorpay_signature) {
            console.error("❌ Signature verification failed");
            return res.status(400).json({ message: "Invalid payment signature" });
        }

        console.log("✅ Signature verified successfully");

        // Fetch subscription info
        const subscription = await Subscription.findById(subscriptionType);
        if (!subscription) {
            console.error("❌ Subscription type not found");
            return res.status(404).json({ message: "Subscription type not found" });
        }
        console.log("📄 Subscription found:", subscription);

        // Update user subscription status
        const user = await User.findByIdAndUpdate(
            subscribedBy,
            { $set: { isSubscribed: true } },
            { new: true }
        );
        if (!user) {
            console.error("❌ User not found");
            return res.status(404).json({ message: "User not found" });
        }
        console.log("👤 User updated with subscription:", user);

        // Calculate start & end date
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + subscription.timePeriod);
        console.log("📆 Subscription period:", startDate, "to", endDate);

        // Create subscription purchase record
        const newPurchase = new SubscriptionPurchase({
            subscriptionType,
            subscribedBy,
            startDate,
            endDate,
            razorpay_order_id,
            razorpay_payment_id
        });

        await newPurchase.save();
        console.log("💾 New purchase saved:", newPurchase);

        return res.status(201).json({
            message: "Subscription purchased and verified successfully",
            data: newPurchase
        });

    } catch (error) {
        console.error("🔥 Error in buySubscription:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};


export const getUserSubscriptions = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const currentDate = new Date();

        // Only get subscriptions where current date is between startDate and endDate
        const subscriptions = await SubscriptionPurchase.find({
            subscribedBy: userId,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate }
        })
            .populate('subscriptionType', 'name price timePeriod')
            .populate('subscribedBy', 'name email');

        console.log("📜 Active subscriptions found for user:", subscriptions);

        if (subscriptions.length === 0) {
            return res.status(404).json({ message: "No active subscriptions found for this user" });
        }

        return res.status(200).json({
            message: "Active user subscriptions retrieved successfully",
            data: subscriptions
        });

    } catch (error) {
        console.error("Error fetching user subscriptions:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
};


export const getFreeTrialSubscription = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Check if user is eligible for free trial
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (!user.isFreeTrialEligible) {
            return res.status(403).json({ message: "User is not eligible for free trial" });
        }


        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 3); // Free trial for 3 months

        // Create free trial subscription purchase
        const freeTrialSubscription = new SubscriptionPurchase({
            subscribedBy: userId,
            startDate,
            endDate
        });

        await freeTrialSubscription.save();

        // Update user to mark free trial as used
        await User.findByIdAndUpdate(userId, { isFreeTrialEligible: false }, { new: true });


        console.log("💾 Free trial subscription saved:", freeTrialSubscription);

        return res.status(201).json({
            message: "Free trial subscription created successfully",
            data: freeTrialSubscription
        });

    } catch (error) {
        console.error("🔥 Error in getFreeTrialSubscription:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
}