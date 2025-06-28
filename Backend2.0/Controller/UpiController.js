import { upidetails } from "../Model/UpiModel.js";

export const addUpiDetails = async (req, res) => {
  try {
    const { upiId, userId } = req.body;

    if (!upiId || !userId) {
      return res.status(400).json({ error: "UPI ID and User ID are required." });
    }

    // Check if already exists
    const existing = await upidetails.findOne({ userId });
    if (existing) {
      return res.status(409).json({ error: "UPI details already exist for this user." });
    }

    const newUpi = await upidetails.create({ upiId, userId });

    return res.status(201).json({
      message: "UPI details added successfully.",
      upiDetails: newUpi,
    });

  } catch (error) {
    console.error("Add UPI Details Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "This UPI or user already exists." });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateUpiDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { upiId } = req.body;

    if (!upiId) {
      return res.status(400).json({ error: "UPI ID is required." });
    }

    const updated = await upidetails.findOneAndUpdate(
      { userId },
      { $set: { upiId } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "UPI details not found for this user." });
    }

    return res.status(200).json({
      message: "UPI details updated successfully.",
      upiDetails: updated
    });

  } catch (error) {
    console.error("Update UPI Details Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteUpiDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const deleted = await upidetails.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({ error: "UPI details not found for this user." });
    }

    return res.status(200).json({ message: "UPI details deleted successfully." });

  } catch (error) {
    console.error("Delete UPI Details Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getUpiDetailsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const details = await upidetails.findOne({ userId });

    if (!details) {
      return res.status(404).json({ error: "UPI details not found for this user." });
    }

    return res.status(200).json({
      message: "UPI details fetched successfully.",
      upiDetails: details
    });

  } catch (error) {
    console.error("Get UPI Details Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
