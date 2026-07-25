import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  const conn = await mongoose.connect(env.MONGO_URI);
  console.log(`✅ MongoDB connected: ${conn.connection.host}`);

  mongoose.connection.on('error', (err) => {
    console.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  return conn;
};
