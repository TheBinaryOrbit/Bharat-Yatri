import mongoose from 'mongoose';
import { QuickDestinationService } from '../services/quickDestination.service.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { OutstationRideService } from '../services/outstationRide.service.js';
import { validateCoordinates } from '../utils/validate.js';
import { toGeoPoint, fromGeoPoint } from '../utils/geo.js';
import { isDuplicateKeyError } from '../utils/duplicateKey.js';
import {
  QUICK_DESTINATION_LIMIT,
  RECENT_DESTINATION_LIMIT,
  RECENT_DESTINATION_MAX_LIMIT,
  RECENT_DESTINATION_SCAN_FACTOR,
} from '../constants/destination.constants.js';

// The apps speak { latitude, longitude }; the collection stores GeoJSON. Everything leaving this
// controller is converted, so a shortcut can be dropped straight into a booking body.
const shape = (destination) => ({
  _id: destination._id,
  tag: destination.tag,
  dropLocationName: destination.dropLocationName,
  dropCoordinates: fromGeoPoint(destination.dropCoordinates),
  createdAt: destination.createdAt,
  updatedAt: destination.updatedAt,
});

export class QuickDestinationController {
  constructor() {
    this.quickDestinationService = new QuickDestinationService();
    this.quickRideService = new QuickRideService();
    this.outstationRideService = new OutstationRideService();
  }

  // POST /api/v3/quick-destinations  (protected — user only)
  createDestination = async (req, res) => {
    // Owner is taken from the auth token, never the request body
    const userId = req.user._id;
    const { tag, dropLocationName, dropCoordinates } = req.body;

    const errors = [];
    if (!tag?.trim()) errors.push({ field: 'tag', message: 'Tag is required' });
    if (!dropLocationName?.trim()) {
      errors.push({ field: 'dropLocationName', message: 'Drop location name is required' });
    }
    const drop = validateCoordinates(dropCoordinates, 'dropCoordinates', errors);

    if (errors.length) {
      return res.status(400).json({ message: 'All fields are required', errors });
    }

    try {
      const count = await this.quickDestinationService.countForUser(userId);
      if (count >= QUICK_DESTINATION_LIMIT) {
        return res.status(409).json({
          message: `You can save up to ${QUICK_DESTINATION_LIMIT} destinations. Delete one to add another.`,
        });
      }

      const destination = await this.quickDestinationService.create({
        userId,
        tag: tag.trim(),
        dropLocationName: dropLocationName.trim(),
        dropCoordinates: toGeoPoint(drop.latitude, drop.longitude),
      });

      return res.status(201).json({ message: 'Destination saved successfully.', destination: shape(destination) });
    } catch (error) {
      console.log(error);
      // The composite (userId, tag) index — duplicateKeyInfo would report this as "userId already
      // exists", which is true and useless, so the tag is named directly.
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          message: `You already have a destination tagged "${tag.trim()}"`,
          errors: [{ field: 'tag', message: 'Tag already used' }],
        });
      }
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid destination', error: error.message });
      }
      return res.status(500).json({ error: 'Failed to save destination', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-destinations  (protected — user only)
  getMyDestinations = async (req, res) => {
    try {
      const destinations = await this.quickDestinationService.getForUser(req.user._id);
      return res.status(200).json({ count: destinations.length, data: destinations.map(shape) });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch destinations', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-destinations/recent  (protected — user only)
  //
  // Drop locations from this rider's own booking history, for the search bar's suggestions. Both
  // ride products are merged, then de-duplicated by name — a rider who books the same commute
  // daily should see it once, followed by four other places, not five copies of one.
  //
  // Deliberately unrelated to the saved shortcuts above despite sharing this route prefix: these
  // are inferred, those are chosen, and the search bar shows both.
  getRecentDestinations = async (req, res) => {
    const requested = Number(req.query.limit);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(Math.trunc(requested), 1), RECENT_DESTINATION_MAX_LIMIT)
      : RECENT_DESTINATION_LIMIT;

    try {
      // Each collection is read wider than the answer, because de-duplication happens after the
      // merge and can collapse a whole window down to one entry.
      const scan = limit * RECENT_DESTINATION_SCAN_FACTOR;

      const [quickRides, outstationRides] = await Promise.all([
        this.quickRideService.getRecentDropLocations(req.user._id, scan),
        this.outstationRideService.getRecentDropLocations(req.user._id, scan),
      ]);

      const merged = [
        ...quickRides.map((ride) => ({ ride, rideType: 'quickride' })),
        ...outstationRides.map((ride) => ({ ride, rideType: 'outstation' })),
      ].sort((a, b) => b.ride.createdAt - a.ride.createdAt);

      const seen = new Set();
      const data = [];

      for (const { ride, rideType } of merged) {
        // Case- and whitespace-insensitive, so "MG Road" and "mg road " are one place. The name is
        // still returned exactly as it was stored on the most recent ride there.
        const key = ride.dropLocationName?.trim().toLowerCase();
        if (!key || seen.has(key)) continue;

        seen.add(key);
        data.push({
          dropLocationName: ride.dropLocationName,
          dropCoordinates: fromGeoPoint(ride.dropCoordinates),
          rideType,
          lastBookedAt: ride.createdAt,
        });

        if (data.length >= limit) break;
      }

      return res.status(200).json({ count: data.length, data });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch recent destinations', message: 'Internal server error' });
    }
  };

  // GET /api/v3/quick-destinations/:id  (protected — user only)
  getDestinationById = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    try {
      const destination = await this.quickDestinationService.getForUserById(req.params.id, req.user._id);
      // Another rider's shortcut reads as "not found" rather than as a 403 that confirms it exists
      if (!destination) return res.status(404).json({ message: 'Destination not found' });

      return res.status(200).json({ destination: shape(destination) });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch destination', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/quick-destinations/:id  (protected — user only)
  // Partial: any of the three fields, but coordinates and the location name move together —
  // a shortcut whose label says one place and whose point is another is worse than no shortcut.
  updateDestination = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    const { tag, dropLocationName, dropCoordinates } = req.body;

    const errors = [];
    const update = {};

    if (tag !== undefined) {
      if (!tag?.trim()) errors.push({ field: 'tag', message: 'Tag cannot be empty' });
      else update.tag = tag.trim();
    }

    if (dropLocationName !== undefined) {
      if (!dropLocationName?.trim()) {
        errors.push({ field: 'dropLocationName', message: 'Drop location name cannot be empty' });
      } else {
        update.dropLocationName = dropLocationName.trim();
      }
    }

    if (dropCoordinates !== undefined) {
      const drop = validateCoordinates(dropCoordinates, 'dropCoordinates', errors);
      if (drop) update.dropCoordinates = toGeoPoint(drop.latitude, drop.longitude);
    }

    if (errors.length) {
      return res.status(400).json({ message: 'Invalid destination', errors });
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({
        message: 'Nothing to update',
        errors: [{ field: 'body', message: 'Send at least one of tag, dropLocationName, dropCoordinates' }],
      });
    }

    try {
      const destination = await this.quickDestinationService.updateForUser(req.params.id, req.user._id, update);
      if (!destination) return res.status(404).json({ message: 'Destination not found' });

      return res.status(200).json({ message: 'Destination updated successfully.', destination: shape(destination) });
    } catch (error) {
      console.log(error);
      if (isDuplicateKeyError(error)) {
        return res.status(409).json({
          message: `You already have a destination tagged "${update.tag}"`,
          errors: [{ field: 'tag', message: 'Tag already used' }],
        });
      }
      if (error.name === 'ValidationError') {
        return res.status(400).json({ message: 'Invalid destination', error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update destination', message: 'Internal server error' });
    }
  };

  // DELETE /api/v3/quick-destinations/:id  (protected — user only)
  deleteDestination = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Destination not found' });
    }

    try {
      const deleted = await this.quickDestinationService.deleteForUser(req.params.id, req.user._id);
      if (!deleted) return res.status(404).json({ message: 'Destination not found' });

      return res.status(200).json({ message: 'Destination deleted successfully.' });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to delete destination', message: 'Internal server error' });
    }
  };
}
