import { Driver } from "../Model/DriverModel.js";
import { uploadDriverFiles } from "../Storage/DriverStorage.js";
import { deleteImageFile } from "../utils/DeleteFiles.js";
import multer from "multer";

export const addDriver = (req, res) => {
  uploadDriverFiles(req, res, async (err) => {
    try {
      console.log(req.body);

      if (err instanceof multer.MulterError || err) {
        
        console.log(err)
        return res.status(400).json({ error: err.message });
      }

      const {
        name, phone, address, city,
        dlNumber, userId
      } = req.body;

      if (!name || !phone || !address || !city || !dlNumber || !userId) {
        return res.status(400).json({ error: "All fields are required." });
      }

      if (!req.files?.driverImage || !req.files?.dlFront || !req.files?.dlBack) {
        return res.status(400).json({ error: "All images (driverImage, dlFront, dlBack) are required." });
      }

      const newDriver = await Driver.create({
        name,
        phone,
        address,
        city,
        dlNumber,
        userId,
        driverImage: req.files.driverImage[0].filename,
        dlFront: req.files.dlFront[0].filename,
        dlBack: req.files.dlBack[0].filename
      });

      return res.status(201).json({
        message: "Driver added successfully.",
        driver: newDriver
      });

    } catch (error) {
      console.error("Add Driver Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

export const deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await Driver.findById(id);

    if (!driver) {
      return res.status(404).json({ error: "Driver not found." });
    }

    // Delete associated images (if stored locally)
    deleteImageFile("./public/driverimages", driver.driverImage);
    deleteImageFile("./public/drivinglicence/front", driver.dlFront);
    deleteImageFile("./public/drivinglicence/back", driver.dlBack);

    // Delete driver record
    await Driver.findByIdAndDelete(id);

    return res.status(200).json({ message: "Driver deleted successfully." });
  } catch (error) {
    console.error("Delete Driver Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDriverByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const driver = await Driver.findOne({ userId });

    if (!driver) {
      return res.status(404).json({ error: "Driver not found for this user." });
    }

    return res.status(200).json({
      message: "Driver fetched successfully.",
      driver,
    });

  } catch (error) {
    console.error("Get Driver by UserId Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};