import { VehicleTypeService } from '../services/vehicleType.service.js';
import { buildFileUrl } from '../utils/fileUrl.js';

export class VehicleTypeController {
  constructor() {
    this.vehicleTypeService = new VehicleTypeService();
  }

  // GET /api/v3/vehicle-types
  getVehicleTypes = async (req, res) => {
    try {
      const types = await this.vehicleTypeService.getAllVehicleTypes();
      return res.status(200).json({ count: types.length, data: types });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch vehicle types', message: 'Internal server error' });
    }
  };

  // GET /api/v3/vehicle-types/:id
  getVehicleTypeById = async (req, res) => {
    try {
      const type = await this.vehicleTypeService.getVehicleTypeById(req.params.id);
      if (!type) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }
      return res.status(200).json(type);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch vehicle type', message: 'Internal server error' });
    }
  };

  // POST /api/v3/vehicle-types
  // multipart/form-data: text fields + `icon` (PNG)
  createVehicleType = async (req, res) => {
    const { slug, name, description, capacity, ratePerKm, ratePerMinute, baseFare } = req.body;

    const errors = [];
    if (!slug) errors.push({ field: 'slug', message: 'Slug is required' });
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    if (capacity == null) errors.push({ field: 'capacity', message: 'Capacity is required' });
    if (ratePerKm == null) errors.push({ field: 'ratePerKm', message: 'Rate per km is required' });
    if (ratePerMinute == null) errors.push({ field: 'ratePerMinute', message: 'Rate per minute is required' });
    if (baseFare == null) errors.push({ field: 'baseFare', message: 'Base fare is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      const existing = await this.vehicleTypeService.getVehicleTypeBySlug(slug.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: 'A vehicle type with this slug already exists' });
      }

      const newType = await this.vehicleTypeService.createVehicleType({
        slug,
        name,
        description,
        capacity,
        ratePerKm,
        ratePerMinute,
        baseFare,
        icon: req.file ? buildFileUrl(req, req.file.filename) : '',
      });
      return res.status(201).json(newType);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to create vehicle type', message: 'Internal server error' });
    }
  };
}
