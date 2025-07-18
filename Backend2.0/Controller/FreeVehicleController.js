import { FreeVehicle } from "../Model/FreeVehicleModel.js";
import convertTo24Hour from "../utils/TimeConverter.js";

export const addFreeVehicle = async (req, res) => {
  try {
    const {
      vehicleType,
      vehicleStartDate,
      vehicleEndDate,
      vehicleStartTime,
      vehicleEndTime,
      vehicleLocation,
      description,
      bookedBy
    } = req.body;

    console.log("📝 Add FreeVehicle Payload:", req.body);

    if (
      !vehicleType || !vehicleStartDate || !vehicleEndDate ||
      !vehicleStartTime || !vehicleEndTime || !vehicleLocation || !bookedBy
    ) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    // Convert to 24-hour format for consistent filtering later
    const startTime24 = convertTo24Hour(vehicleStartTime);
    const endTime24 = convertTo24Hour(vehicleEndTime);

    const newRide = await FreeVehicle.create({
      vehicleType,
      vehicleStartDate,
      vehicleEndDate,
      vehicleStartTime: startTime24,
      vehicleEndTime: endTime24,
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



export const getAvailableFreeRides = async (req, res) => {
  try {
    const now = new Date();
    const nowIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    const currentDate = nowIST.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentTime = `${nowIST.getHours().toString().padStart(2, '0')}:${nowIST.getMinutes().toString().padStart(2, '0')}`;

    console.log("📅 Current IST Date:", currentDate);
    console.log("⏰ Current IST Time:", currentTime);

    const rides = await FreeVehicle.find({
      isCompleted: false,
      vehicleStartDate: { $lte: currentDate },
      vehicleEndDate: { $gte: currentDate }
    }).populate('bookedBy', 'name phoneNumber email _id');

    const filteredRides = rides.filter(ride => {
      const isTodayStart = ride.vehicleStartDate === currentDate;
      const isTodayEnd = ride.vehicleEndDate === currentDate;

      // If ride is only for today — check both start and end time
      if (isTodayStart && isTodayEnd) {
        return (
          ride.vehicleStartTime <= currentTime &&
          ride.vehicleEndTime >= currentTime
        );
      }

      // If today is the start date — check start time
      if (isTodayStart) {
        return ride.vehicleStartTime <= currentTime;
      }

      // If today is the end date — check end time
      if (isTodayEnd) {
        return ride.vehicleEndTime >= currentTime;
      }

      // If it's between the start and end dates — always valid
      return true;
    });

    return res.status(200).json({
      message: "Filtered available free vehicle rides",
      rides: filteredRides
    });

  } catch (error) {
    console.error("Get Available Rides Error:", error);
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