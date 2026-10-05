import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Driver } from '../src/models/driver.model.js';
import { Vehicle } from '../src/models/vehicle.model.js';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from .env');
  }

  await mongoose.connect("mongodb+srv://anissh946:PEjlJ3BoJ0Avl5yk@cluster0.exjn5.mongodb.net/bharat_yatri");
  console.log('Connected to MongoDB');

  try {
    const drivers = await Driver.find({
      name: /^unknown$/i,
    }).select('_id name phoneNumber');

    if (drivers.length === 0) {
      console.log('No drivers found with name "unknown".');
      return;
    }

    const driverIds = drivers.map((driver) => driver._id);

    const vehicles = await Vehicle.find({
      driverId: { $in: driverIds },
    }).select('_id driverId vehicleNumber');

    if (vehicles.length === 0) {
      console.log('No vehicles found for drivers named "unknown".');
      return;
    }

    console.log('Drivers to delete:');
    console.table(
      drivers.map((driver) => ({
        id: driver._id.toString(),
        name: driver.name,
        phoneNumber: driver.phoneNumber,
      }))
    );

    console.log('Vehicles to delete:');
    console.table(
      vehicles.map((vehicle) => ({
        id: vehicle._id.toString(),
        driverId: vehicle.driverId.toString(),
        vehicleNumber: vehicle.vehicleNumber,
      }))
    );

    const vehicleIds = vehicles.map((vehicle) => vehicle._id);

    // Delete vehicles first, then their matching drivers.
    const vehicleResult = await Vehicle.deleteMany({
      _id: { $in: vehicleIds },
    });

    const driverResult = await Driver.deleteMany({
      _id: { $in: driverIds },
    });

    console.log(`Deleted vehicles: ${vehicleResult.deletedCount}`);
    console.log(`Deleted drivers: ${driverResult.deletedCount}`);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exitCode = 1;
});