import { subscription } from "../../Modal/SuscriptionModal.js";
import { user } from "../../Modal/UserModals.js";


export const handleBuySubscription = async (req, res) => {
    try {
        console.log(req.body);
        const { SubscriptionId, UserId } = req.body;

        // wrong parameters and invalid body
        if (!SubscriptionId || !UserId) return res.status(400).json({ "error": "All fields are required" });
        if (SubscriptionId.length !== 24) return res.status(400).json({ "error": "Wrong Subscription Id" });
        if (UserId.length !== 24) return res.status(400).json({ "error": "Wrong user Id" });

        const SubscriptionDetails = await subscription.findOne({ _id: SubscriptionId });

        if (SubscriptionDetails.subscriptionType === "Trial") {
            const result = await user.findOneAndUpdate(
                { _id: UserId, freeTrailEligibility: true },
                {
                    $set: {
                        isSubscribed: true,
                        SubscriptionStaredDate: new Date(),
                        SubscriptionEndDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                        freeTrailEligibility: false
                    }
                },
                { new: true }
            );

            if (!result) {
                return res.status(400).json({ error: "User not eligible for free trial." });
            }

            return res.status(200).json({ message: "Trial subscription applied.", result });
        }


        let endDays = SubscriptionDetails.timePeriod;

        const result = await user.findByIdAndUpdate(
            UserId,
            {
                $set: {
                    isSubscribed: true,
                    SubscriptionStaredDate: new Date(),
                    SubscriptionEndDate: new Date(new Date().setDate(new Date().getDate() + endDays))
                }
            },
            { new: true }
        );

        if (!result) return res.status(400).json({ "message": "Unable to apply the Subscription" });
        return res.status(200).json({ "message": "Subscription applied." });
    } catch (error) {
        console.log(error);
        res.status(500).json({ "error": "Internal server error" })
    }
}


export const handleAddSubscription = async (req, res) => {
    try {
        if (!req.body || !req.body.subscriptionType || !req.body.price || !req.body.description || !req.body.benefits || !req.body.timePeriod) return res.status(400).json({ "error": "All Fields Are Requires" });

        const benefits = JSON.stringify(req.body.benefits)
        const result = await subscription.create({
            subscriptionType: req.body.subscriptionType,
            price: req.body.price,
            description: req.body.description,
            timePeriod: req.body.timePeriod,
            benefits: benefits
        })

        if (!result) return res.status(503).json({ "error": "Unable to add the Subscription" });
        return res.status(201).json({ "message": "Subscription Added Sucessfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ "error": "Internal server error" })
    }
}


export const handleUpdateSubscription = async (req, res) => {
    try {
        const id = req.params.id;
        if (Object.keys(req.body).length == 0) return res.status(400).json({ "error": "Update Fields Are Required" });

        const result = await subscription.findByIdAndUpdate(id, req.body, { new: true });

        if (!result) return res.status(503).json({ "error": "Unable to update the Subscription" });

        return res.status(200).json({ "message": "Subscription Details Updated Sucessfully" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ "error": "Internal server error" })
    }
}

export const handleDeleteSubscription = async (req, res) => {
    try {
        const id = req.params.id;

        const result = await subscription.findByIdAndDelete(id);

        if (!result) return res.status(503).json({ "error": "Unable to Delete the Subscription" });

        return res.status(200).json({ "message": "Subscription Deleted Sucessfully" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ "error": "Internal server error" })
    }
}

export const handleGetSubscription = async (req, res) => {
    try {
        let result = await subscription.find({});

        if (!result) return res.status(500).json({ "error": "Error in Getting Subscription" });
        return res.status(200).json(result);
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting Subscription" });
    }
}

export const handleSpecficGetSubscription = async (req, res) => {
    try {
        const id = req.params.id
        let result = await subscription.findById(id);

        if (!result) return res.status(500).json({ "error": "Error in Getting Subscription" });
        return res.status(200).json(result);
    } catch (e) {
        console.log(e)
        return res.status(500).json({ "error": "Error in Getting Subscription" });
    }
}