import { Subscription } from "../Model/SubscriptionModel.js";

export const addSubscription = async (req, res) => {
  try {
    const { title, price, benefits , timePeriod } = req.body;

    if (!title || !price || !benefits ) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const newSubscription = await Subscription.create({
      title,
      price,
      benefits,
      timePeriod
    });

    return res.status(201).json({
      message: "Subscription added successfully.",
      subscription: newSubscription,
    });

  } catch (error) {
    console.error("Add Subscription Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteSubscription = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Subscription.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Subscription not found." });
    }

    return res.status(200).json({ message: "Subscription deleted successfully." });

  } catch (error) {
    console.error("Delete Subscription Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await Subscription.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Subscriptions fetched successfully.",
      subscriptions
    });

  } catch (error) {
    console.error("Get Subscriptions Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
