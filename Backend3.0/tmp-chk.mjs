import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { Vehicle } from './src/models/vehicle.model.js';
await connectDB();
const dup = await Vehicle.aggregate([{ $group: { _id: '$driverId', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
console.log('total vehicles:', await Vehicle.countDocuments());
console.log('drivers with >1 vehicle:', dup.length, JSON.stringify(dup));
console.log('indexes:', (await Vehicle.collection.indexes()).map((i) => `${i.name} ${JSON.stringify(i.key)}${i.unique ? ' UNIQUE' : ''}`).join(' | '));
await mongoose.disconnect();
