import mongoose from 'mongoose';
import { VehicleService } from '../services/vehicle.service.js';
import { VehicleTypeService } from '../services/vehicleType.service.js';
import { buildFileUrl } from '../utils/fileUrl.js';

export class VehicleController {
  constructor() {
    this.vehicleService = new VehicleService();
    this.vehicleTypeService = new VehicleTypeService();
  }

  // Accepts either a VehicleType ObjectId or its slug (e.g. "bharat_mini")
  resolveVehicleType = async (vehicleTypeId) => {
    if (mongoose.isValidObjectId(vehicleTypeId)) {
      return this.vehicleTypeService.getVehicleTypeById(vehicleTypeId);
    }
    return this.vehicleTypeService.getVehicleTypeBySlug(String(vehicleTypeId).toLowerCase());
  };

  // GET /api/v3/vehicles
  getVehicles = async (req, res) => {
    try {
      const vehicles = await this.vehicleService.getAllVehicles();
      return res.status(200).json({ count: vehicles.length, data: vehicles });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch vehicles', message: 'Internal server error' });
    }
  };

  // GET /api/v3/vehicles/:id
  getVehicleById = async (req, res) => {
    try {
      const vehicle = await this.vehicleService.getVehicleById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }
      return res.status(200).json(vehicle);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch vehicle', message: 'Internal server error' });
    }
  };

  // GET /api/v3/vehicles/my  (protected — driver only)
  // Driver is taken from the auth token, never a URL param
  getMyVehicles = async (req, res) => {
    try {
      const vehicles = await this.vehicleService.getVehiclesByDriver(req.user._id);
      return res.status(200).json({ count: vehicles.length, data: vehicles });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch vehicles', message: 'Internal server error' });
    }
  };

  // POST /api/v3/vehicles  (protected — driver only)
  // multipart/form-data: text fields + vehicleImages[] (max 3), rcFrontImage, rcBackImage
  createVehicle = async (req, res) => {
    // Driver is taken from the auth token, never the request body
    const driverId = req.user._id;

    const {
      vehicleTypeId,
      vehicleNumber,
      vehicleName,
      ownerName,
      seatingCapacity,
      manufactureYear,
      insuranceExpiryMonth,
      insuranceExpiryYear,
    } = req.body;

    const errors = [];
    if (!vehicleTypeId) errors.push({ field: 'vehicleTypeId', message: 'Vehicle type is required' });
    if (!vehicleNumber) errors.push({ field: 'vehicleNumber', message: 'Vehicle number is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      const vehicleType = await this.resolveVehicleType(vehicleTypeId);
      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }

      const existing = await this.vehicleService.getVehicleByNumber(vehicleNumber.toUpperCase());
      if (existing) {
        return res.status(409).json({ message: 'A vehicle with this number already exists' });
      }

      const files = req.files || {};
      const vehicleImages = (files.vehicleImages || []).map((f) => buildFileUrl(req, f.filename));
      const rcFront = files.rcFrontImage?.[0] ? buildFileUrl(req, files.rcFrontImage[0].filename) : '';
      const rcBack = files.rcBackImage?.[0] ? buildFileUrl(req, files.rcBackImage[0].filename) : '';

      const newVehicle = await this.vehicleService.createVehicle({
        driverId,
        vehicleTypeId: vehicleType._id,
        vehicleNumber,
        vehicleName,
        ownerName,
        seatingCapacity,
        manufactureYear,
        insuranceExpiry: {
          month: insuranceExpiryMonth ? Number(insuranceExpiryMonth) : undefined,
          year: insuranceExpiryYear ? Number(insuranceExpiryYear) : undefined,
        },
        vehicleImages,
        rcDetails: { frontImageUrl: rcFront, backImageUrl: rcBack },
      });

      return res.status(201).json(newVehicle);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to create vehicle', message: 'Internal server error' });
    }
  };
}
