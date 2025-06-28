import { BankDetails } from "../Model/BankDetailsModel.js";

export const addBankDetails = async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName, userId } = req.body;

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName || !userId) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Prevent duplicate bank details for the same user
    const existing = await BankDetails.findOne({ userId });
    if (existing) {
      return res.status(409).json({ error: "Bank details already exist for this user." });
    }

    const newDetails = await BankDetails.create({
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      userId
    });

    res.status(201).json({
      message: "Bank details added successfully.",
      bankDetails: newDetails
    });

  } catch (error) {
    console.error("Add BankDetails Error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Account number or user already exists." });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const updated = await BankDetails.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Bank details not found for this user." });
    }

    res.status(200).json({
      message: "Bank details updated successfully.",
      bankDetails: updated
    });

  } catch (error) {
    console.error("Update BankDetails Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const deleteBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const deleted = await BankDetails.findOneAndDelete({ userId });

    if (!deleted) {
      return res.status(404).json({ error: "Bank details not found for this user." });
    }

    res.status(200).json({ message: "Bank details deleted successfully." });

  } catch (error) {
    console.error("Delete BankDetails Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getBankDetailsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const bankDetails = await BankDetails.findOne({ userId });

    if (!bankDetails) {
      return res.status(404).json({ error: "Bank details not found for this user." });
    }

    res.status(200).json({
      message: "Bank details fetched successfully.",
      bankDetails
    });

  } catch (error) {
    console.error("Get BankDetails Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

