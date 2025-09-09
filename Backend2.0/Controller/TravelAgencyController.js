import TravelAgency from '../Model/TravelAgencyModel.js';

export const createTravelAgency = async (req, res) => {
  try {
    const agency = new TravelAgency(req.body);
    await agency.save();
    res.status(201).json(agency);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getAllTravelAgencies = async (req, res) => {
  try {
    const agencies = await TravelAgency.find();
    res.json(agencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTravelAgency = async (req, res) => {
  try {
    const updatedAgency = await TravelAgency.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedAgency) {
      return res.status(404).json({ error: 'Travel Agency not found' });
    }
    res.json(updatedAgency);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const findTravelAgencyById = async (req, res) => {
  try {
    const agency = await TravelAgency.findById(req.params.id);
    if (!agency) {
      return res.status(404).json({ error: 'Travel Agency not found' });
    }
    res.json(agency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const findTravelAgencyByUserId = async (req, res) => {
  try {
    const agency = await TravelAgency.findOne({ userId: req.params.userId });
    if (!agency) {
      return res.status(404).json({ error: 'Travel Agency not found' });
    }
    res.json(agency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const upsertTravelAgency = async (req, res) => {
  try {
    const filter = { userId: req.body.userId };
    const update = {
      travelAgencyName: req.body.travelAgencyName,
      contactPersonName: req.body.contactPersonName,
      mobileNumber: req.body.mobileNumber,
      city: req.body.city,
      // ...any other fields
    };
    const options = { new: true, upsert: true, runValidators: true };
    
    const agency = await TravelAgency.findOneAndUpdate(filter, update, options);
    res.status(200).json(agency);
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error code
      res.status(400).json({ error: 'Travel agency for this user already exists.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};
