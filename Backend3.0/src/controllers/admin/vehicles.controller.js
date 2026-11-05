import { Vehicle } from '../../models/vehicle.model.js';
import { VehicleType } from '../../models/vehicleType.model.js';
import { QuickRide } from '../../models/quickRide.model.js';
import { OutstationRide } from '../../models/outstationRide.model.js';
import { VehicleTypeService } from '../../services/vehicleType.service.js';
import { recordAudit, diffFields } from '../../services/admin/audit.service.js';
import { buildFileUrl } from '../../utils/fileUrl.js';
import { FareService } from '../../services/fare.service.js';
import { badRequest, containsRegex, handle, isId, listResponse, maskPerson, pageParams, sortParams, toId } from './helpers.js';

const vehicleTypeService = new VehicleTypeService();
const fareService = new FareService();

const PRICING_FIELDS = ['baseFare', 'ratePerKm', 'ratePerMinute'];
const TYPE_FIELDS = ['name', 'description', 'capacity', ...PRICING_FIELDS, 'features', 'isActive', 'icon'];

// Reads and validates the editable vehicle-type fields. Multipart bodies arrive as strings.
const readTypeBody = (body, errors, { requireAll }) => {
  const out = {};
  const num = (field, { min = 0, max = 100000, integer = false } = {}) => {
    if (body[field] === undefined || body[field] === '') {
      if (requireAll) errors.push({ field, message: 'Required' });
      return;
    }
    const n = Number(body[field]);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      errors.push({ field, message: `Enter ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}` });
      return;
    }
    out[field] = n;
  };

  if (body.name !== undefined || requireAll) {
    const name = String(body.name ?? '').trim();
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    else out.name = name;
  }
  if (body.description !== undefined) out.description = String(body.description).trim();
  num('capacity', { min: 1, max: 60, integer: true });
  num('baseFare', { max: 100000 });
  num('ratePerKm', { max: 10000 });
  num('ratePerMinute', { max: 10000 });

  if (body.features !== undefined) {
    let features = body.features;
    if (typeof features === 'string') {
      try {
        features = JSON.parse(features);
      } catch {
        features = features.split(',');
      }
    }
    if (!Array.isArray(features)) errors.push({ field: 'features', message: 'Features must be a list' });
    else out.features = features.map((f) => String(f).trim()).filter(Boolean).slice(0, 12);
  }
  if (body.isActive !== undefined) out.isActive = body.isActive === true || body.isActive === 'true';
  return out;
};

export class VehiclesController {
  // GET /admin/vehicles?q&vehicleTypeId&insurance=expired|expiring
  list = handle('load vehicles', async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const filter = {};
    if (isId(req.query.vehicleTypeId)) filter.vehicleTypeId = toId(req.query.vehicleTypeId);
    if (req.query.q) {
      const rx = containsRegex(req.query.q);
      filter.$or = [{ vehicleNumber: containsRegex(String(req.query.q).toUpperCase()) }, { vehicleName: rx }, { ownerName: rx }];
    }
    if (req.query.insurance === 'expired' || req.query.insurance === 'expiring') {
      const now = new Date();
      const ym = now.getFullYear() * 12 + now.getMonth(); // months since year 0, current month
      const monthsExpr = { $add: [{ $multiply: ['$insuranceExpiry.year', 12] }, { $subtract: ['$insuranceExpiry.month', 1] }] };
      filter.$expr =
        req.query.insurance === 'expired'
          ? { $lt: [monthsExpr, ym] }
          : { $and: [{ $gte: [monthsExpr, ym] }, { $lte: [monthsExpr, ym + 1] }] };
      filter['insuranceExpiry.year'] = { $ne: null };
    }

    const [rows, total] = await Promise.all([
      Vehicle.find(filter)
        .populate('vehicleTypeId', 'name')
        .populate('driverId', 'name phoneNumber isBlocked kycStatus')
        .sort(
          sortParams(
            req.query,
            {
              number: 'vehicleNumber',
              name: 'vehicleName',
              owner: 'ownerName',
              seats: 'seatingCapacity',
              year: 'manufactureYear',
              insurance: ['insuranceExpiry.year', 'insuranceExpiry.month'],
              added: 'createdAt',
            },
            { createdAt: -1 }
          )
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      Vehicle.countDocuments(filter),
    ]);
    rows.forEach((v) => maskPerson(req, v.driverId));
    return listResponse(res, { data: rows, total, page, limit });
  });

  // GET /admin/vehicles/:id
  detail = handle('load vehicle', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid vehicle id' });
    const vehicle = await Vehicle.findById(id)
      .populate('vehicleTypeId', 'name slug capacity')
      .populate('driverId', 'name phoneNumber profileImageUrl isBlocked kycStatus createdAt')
      .lean();
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    const driverId = vehicle.driverId?._id;
    const [quick, out] = await Promise.all([
      driverId ? QuickRide.countDocuments({ assignedTo: driverId, rideStatus: 'completed' }) : 0,
      driverId ? OutstationRide.countDocuments({ assignedTo: driverId, rideStatus: 'completed' }) : 0,
    ]);
    maskPerson(req, vehicle.driverId);
    return res.status(200).json({ vehicle, completedRides: { quick, outstation: out } });
  });

  // GET /admin/vehicle-types — all of them, inactive included, with how many vehicles use each
  listTypes = handle('load vehicle types', async (req, res) => {
    const [types, usage] = await Promise.all([
      VehicleType.find().sort({ createdAt: 1 }).lean(),
      Vehicle.aggregate([{ $group: { _id: '$vehicleTypeId', count: { $sum: 1 } } }]),
    ]);
    const used = new Map(usage.map((u) => [String(u._id), u.count]));
    return res.status(200).json({ data: types.map((t) => ({ ...t, vehicleCount: used.get(String(t._id)) || 0 })) });
  });

  // POST /admin/vehicle-types  (multipart; optional PNG `icon`)
  createType = handle('create vehicle type', async (req, res) => {
    const errors = [];
    const slug = String(req.body?.slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{2,40}$/.test(slug)) errors.push({ field: 'slug', message: 'Use 2–40 lowercase letters, numbers, _ or -' });
    const data = readTypeBody(req.body || {}, errors, { requireAll: true });
    if (errors.length) return badRequest(res, errors);
    if (await VehicleType.exists({ slug })) return badRequest(res, [{ field: 'slug', message: 'This slug is already used' }]);

    const created = await vehicleTypeService.createVehicleType({
      slug,
      ...data,
      icon: req.file ? buildFileUrl(req, req.file.filename) : '',
    });
    await recordAudit(req, { action: 'vehicleType.create', entity: 'vehicleType', entityId: created._id, after: created });
    return res.status(201).json(created);
  });

  // PATCH /admin/vehicle-types/:id  (multipart; optional PNG `icon`). Slug is fixed once created —
  // the apps and existing rides refer to it.
  updateType = handle('update vehicle type', async (req, res) => {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: 'Invalid vehicle type id' });
    const existing = await VehicleType.findById(id).lean();
    if (!existing) return res.status(404).json({ message: 'Vehicle type not found' });

    const errors = [];
    const data = readTypeBody(req.body || {}, errors, { requireAll: false });
    if (errors.length) return badRequest(res, errors);
    if (req.file) data.icon = buildFileUrl(req, req.file.filename);
    if (!Object.keys(data).length) return res.status(400).json({ message: 'Nothing to change' });

    const updated = await vehicleTypeService.updateVehicleType(id, data);
    const diff = diffFields(existing, updated.toObject(), TYPE_FIELDS);
    const pricingChanged = PRICING_FIELDS.some((f) => f in diff.after);
    await recordAudit(req, {
      action: pricingChanged ? 'vehicleType.pricing_update' : 'vehicleType.update',
      entity: 'vehicleType',
      entityId: id,
      ...diff,
      reason: String(req.body?.reason ?? '').trim(),
    });
    return res.status(200).json(updated);
  });

  // POST /admin/vehicle-types/fare-preview  { baseFare, ratePerKm, ratePerMinute, distanceKm, durationMin }
  farePreview = (req, res) => {
    const b = req.body || {};
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const suggestedFare = fareService.computeSuggestedFare(
      { baseFare: n(b.baseFare), ratePerKm: n(b.ratePerKm), ratePerMinute: n(b.ratePerMinute) },
      n(b.distanceKm),
      n(b.durationMin)
    );
    return res.status(200).json({ suggestedFare, offerBounds: fareService.getOfferBounds(suggestedFare) });
  };
}
