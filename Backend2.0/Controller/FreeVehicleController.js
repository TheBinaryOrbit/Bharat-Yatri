import { FreeVehicle } from "../Model/FreeVehicleModel.js";

export const addFreeVehicle = async (req, res) => {
  try {
    const {
      vehicleType,
      vehicleStartTime,
      vehicleEndTime,
      vehicleLocation,
      description,
      bookedBy
    } = req.body;

    if (!vehicleType || !vehicleStartTime || !vehicleEndTime || !vehicleLocation || !bookedBy) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    const newRide = await FreeVehicle.create({
      vehicleType,
      vehicleStartTime,
      vehicleEndTime,
      vehicleLocation,
      description,
      bookedBy
    });

    return res.status(201).json({
      message: "Free vehicle ride added successfully.",
      ride: newRide
    });
  } catch (error) {
    console.error("Add FreeVehicle Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const deleteFreeVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await FreeVehicle.findByIdAndDelete(id)

    if (!deleted) {
      return res.status(404).json({ error: "Ride not found." });
    }

    return res.status(200).json({ message: "Ride deleted successfully." });
  } catch (error) {
    console.error("Delete FreeVehicle Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const markFreeVehicleAsCompleted = async (req, res) => {
  try {
    const { id } = req.params;

    const ride = await FreeVehicle.findByIdAndUpdate(
      id,
      { isCompleted: true },
      { new: true }
    ).populate('bookedBy');

    if (!ride) {
      return res.status(404).json({ error: "Ride not found." });
    }

    return res.status(200).json({
      message: "Ride marked as completed.",
      ride
    });
  } catch (error) {
    console.error("Mark Completed Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getFreeVehiclesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const rides = await FreeVehicle.find({ bookedBy: userId }).populate('bookedBy');

    return res.status(200).json({ rides });
  } catch (error) {
    console.error("Get Rides by User Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


export const getAvailableFreeRides = async (req, res) => {
  try {
    // Get current Indian Standard Time (IST)
    const nowIST = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Format: "04:23 PM"
    const currentTime = nowIST;

    const rides = await FreeVehicle.find({
      isCompleted: false,
      vehicleStartTime: { $lte: currentTime },
      vehicleEndTime: { $gte: currentTime }
    }).populate('bookedBy');

    return res.status(200).json({
      message: `Rides available at ${currentTime}`,
      rides
    });
  } catch (error) {
    console.error("Get Available Rides Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};