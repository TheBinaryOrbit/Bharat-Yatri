import mongoose from 'mongoose';

const TravelAgencySchema = new mongoose.Schema({
  travelAgencyName: {
    type: String,
    required: [true, 'Travel Agency Name is required'],
    trim: true,
  },
  contactPersonName: {
    type: String,
    required: [true, 'Contact Person Name is required'],
    trim: true,
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile Number is required'],
    trim: true,
    match: [/^\+?[0-9]{7,15}$/, 'Please enter a valid phone number'],
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
  },

  userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',  // Reference to User collection
  required: true,
    }
}, {
  timestamps: true, // automatically add createdAt and updatedAt fields
});

TravelAgencySchema.index({ userId: 1 }, { unique: true });

const TravelAgency = mongoose.model('TravelAgency', TravelAgencySchema);
export default TravelAgency;
