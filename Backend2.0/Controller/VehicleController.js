import { Vehicle } from "../Model/VehicleModel.js";
import { uploadVehicleFiles } from "../Storage/VehicleStorage.js";
import { deleteImageFile } from "../utils/DeleteFiles.js";

export const addVehicle = (req, res) => {

  uploadVehicleFiles(req, res, async (err) => {
    try {
      console.log(req.body);
      if (err) {
        console.log(err);
        return res.status(400).json({ error: err.message });
      }

      const {
        vehicleType, registrationNumber, yearOfManufacture, userId
      } = req.body;

      if (!vehicleType || !registrationNumber || !yearOfManufacture || !userId) {
        return res.status(400).json({ error: "All required fields must be provided." });
      }

      // remove the insurance image requirement
      // if (!req.files.insuranceImage) {
      //   return res.status(400).json({ error: "Insurance image is required." });
      // }

      if (!req.files.vehicleImages || req.files.vehicleImages.length === 0) {
        return res.status(400).json({ error: "At least one vehicle image is required." });
      }

      const vehicle = await Vehicle.create({
        vehicleType,
        registrationNumber,
        yearOfManufacture,
        // insuranceExpDate,
        // insuranceImage: `/vehicle/insurance/${req.files.insuranceImage[0].filename}`,
        rcImage: req.files.rcImage ? `/vehicle/rc/${req.files.rcImage[0].filename}` : null,
        vehicleImages: req.files.vehicleImages.map(f => `/vehicle/images/${f.filename}`),
        userId
      });

      return res.status(201).json({ message: "Vehicle added successfully.", vehicle });

    } catch (error) {
      console.error("Add Vehicle Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
};

export const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) return res.status(404).json({ error: "Vehicle not found." });

    // Delete files
    deleteImageFile("./public/vehicle/insurance", vehicle.insuranceImage);
    deleteImageFile("./public/vehicle/rc", vehicle.rcImage);
    vehicle.vehicleImages.forEach(img => deleteImageFile("./public/vehicle/images", img));

    await Vehicle.findByIdAndDelete(id);

    return res.status(200).json({ message: "Vehicle deleted successfully." });

  } catch (error) {
    console.error("Delete Vehicle Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getVehiclesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    const vehicles = await Vehicle.find({ userId });

    // {
      //   vehicleType : 1,
      //   registrationNumber : 1,
      //   yearOfManufacture : 1,
      //   vehicleImages : 1,
      // }

    if (!vehicles || vehicles.length === 0) {
      return res.status(404).json({ error: "No vehicles found for this user." });
    }

    return res.status(200).json({
      message: "Vehicles fetched successfully.",
      vehicles
    });

  } catch (error) {
    console.error("Get Vehicles Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
