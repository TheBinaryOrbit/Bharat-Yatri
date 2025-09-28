import mongoose from 'mongoose';
import Admin from '../Model/admin.js';
import { generatePassword } from './password.js';
import 'dotenv/config';

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect("mongodb+srv://anissh946:It2g9lcagvvmXIFY@cluster0.exjn5.mongodb.net/");
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Generate admin user
const generateAdmin = async (name, email, password) => {
    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            console.log('Admin with this email already exists');
            return;
        }

        // Generate hashed password
        const hashedPassword = generatePassword(password);

        // Create new admin
        const newAdmin = new Admin({
            name,
            email,
            password: hashedPassword
        });

        // Save admin to database
        await newAdmin.save();
        console.log('Admin created successfully:');
        console.log(`Name: ${name}`);
        console.log(`Email: ${email}`);
        console.log('Password: [HASHED]');
        
    } catch (error) {
        console.error('Error creating admin:', error);
    }
};

// Main function to run the script
const main = async () => {
    await connectDB();
    
    // Get command line arguments or use default values
    const args = process.argv.slice(2);
    
    const name = args[0] || 'Super Admin';
    const email = args[1] || 'admin@bharatyatri.com';
    const password = args[2] || 'admin123';
    
    console.log('Generating admin with:');
    console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('---');
    
    await generateAdmin(name, email, password);
    
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
};

// Run the script
main().catch((error) => {
    console.error('Script error:', error);
    process.exit(1);
});
