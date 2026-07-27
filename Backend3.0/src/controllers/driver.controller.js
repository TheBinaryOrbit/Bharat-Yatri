import mongoose from 'mongoose';
import { DriverService } from '../services/driver.service.js';
import { KycService } from '../services/kyc.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { VehicleTypeService } from '../services/vehicleType.service.js';
import { buildFileUrl } from '../utils/fileUrl.js';
import { isDuplicateKeyError, duplicateKeyInfo } from '../utils/duplicateKey.js';
import { generateToken } from '../utils/token.js';
import { env } from '../config/env.js';

export class DriverController {
  constructor() {
    this.driverService = new DriverService();
    this.kycService = new KycService();
    this.vehicleService = new VehicleService();
    this.vehicleTypeService = new VehicleTypeService();
  }

  // GET /api/v3/drivers
  getDrivers = async (req, res) => {
    try {
      const drivers = await this.driverService.getAllDrivers();
      return res.status(200).json({ count: drivers.length, data: drivers });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch drivers', message: 'Internal server error' });
    }
  };

  // GET /api/v3/drivers/me  (protected) — current driver from the auth token
  getMe = async (req, res) => {
    return res.status(200).json(req.user);
  };

  // GET /api/v3/drivers/:id  (admin — later work)
  getDriverById = async (req, res) => {
    try {
      const driver = await this.driverService.getDriverById(req.params.id);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      return res.status(200).json(driver);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch driver', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/drivers/me  (protected — driver only)
  // Partial update of the signed-in driver's own profile. Driver comes from the
  // token, never the body. Phone number and KYC state are not editable here.
  // multipart/form-data: text fields + profileImage, dlFrontImage, dlBackImage
  updateMe = async (req, res) => {
    const driverId = req.user._id;
    const { name, email, dob, gender, address, aadharCardNumber, dlNumber } = req.body;
    const files = req.files || {};

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({
        message: 'Name is invalid',
        errors: [{ field: 'name', message: 'Name cannot be empty' }],
      });
    }

    if (dob !== undefined && Number.isNaN(Date.parse(dob))) {
      return res.status(400).json({
        message: 'Date of birth is invalid',
        errors: [{ field: 'dob', message: 'Date of birth must be a valid date (YYYY-MM-DD)' }],
      });
    }

    if (gender !== undefined && !String(gender).match(/^(male|female|other)$/i)) {
      return res.status(400).json({
        message: 'Gender is invalid',
        errors: [{ field: 'gender', message: 'Gender must be one of: male, female, other' }],
      });
    }

    // Only touch the fields actually sent — dot notation keeps dlDetails siblings intact
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (dob !== undefined) updates.dob = dob;
    if (gender !== undefined) updates.gender = String(gender).toLowerCase();
    if (address !== undefined) updates.address = address;
    if (aadharCardNumber !== undefined) updates.aadharCardNumber = aadharCardNumber;
    if (dlNumber !== undefined) updates['dlDetails.dlNumber'] = dlNumber;

    if (files.profileImage?.[0]) updates.profileImageUrl = buildFileUrl(req, files.profileImage[0].filename);
    if (files.dlFrontImage?.[0]) updates['dlDetails.dlFrontImageUrl'] = buildFileUrl(req, files.dlFrontImage[0].filename);
    if (files.dlBackImage?.[0]) updates['dlDetails.dlBackImageUrl'] = buildFileUrl(req, files.dlBackImage[0].filename);

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    try {
      const driver = await this.driverService.updateDriver(driverId, updates);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      return res.status(200).json({ message: 'Profile updated successfully.', driver });
    } catch (error) {
      console.log(error);
      if (isDuplicateKeyError(error)) {
        const { field, label, message } = duplicateKeyInfo(error);
        return res.status(409).json({ message: `${label} already registered`, errors: [{ field, message }] });
      }
      return res.status(500).json({ error: 'Failed to update profile', message: 'Internal server error' });
    }
  };

  // POST /api/v3/drivers/onboard
  // One multipart call → creates the driver AND their vehicle, returns a JWT.
  // A driver may own exactly one vehicle, so this is the only place it's created.
  // Files: profileImage, dlFrontImage, dlBackImage, vehicleImages[] (≤3), rcFrontImage, rcBackImage
  onboardDriver = async (req, res) => {
    const {
      // driver
      name, email, phoneNumber, dob, gender, address, aadharCardNumber, dlNumber,
      // vehicle
      vehicleTypeId, vehicleNumber, vehicleName, ownerName, seatingCapacity,
      manufactureYear, insuranceExpiryMonth, insuranceExpiryYear,
    } = req.body;


    const userid = req.user._id;

    if (!userid) {
      return res.status(401).json({ message: 'Unauthorized: user ID missing from token' });
    }

    const files = req.files || {};

    const errors = [];
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    if (!phoneNumber) errors.push({ field: 'phoneNumber', message: 'Phone number is required' });
    if (!dob) errors.push({ field: 'dob', message: 'Date of birth is required' });
    if (!files.profileImage?.[0]) errors.push({ field: 'profileImage', message: 'Profile photo is required' });
    if (!vehicleTypeId) errors.push({ field: 'vehicleTypeId', message: 'Vehicle type is required' });
    if (!vehicleNumber) errors.push({ field: 'vehicleNumber', message: 'Vehicle number is required' });
    if (errors.length) {
      return res.status(400).json({ message: 'All required fields must be provided', errors });
    }

    if (Number.isNaN(Date.parse(dob))) {
      return res.status(400).json({
        message: 'Date of birth is invalid',
        errors: [{ field: 'dob', message: 'Date of birth must be a valid date (YYYY-MM-DD)' }],
      });
    }

    if (gender && !gender.match(/^(male|female|other)$/i)) {
      return res.status(400).json({
        message: 'Gender is invalid',
        errors: [{ field: 'gender', message: 'Gender must be one of: male, female, other' }],
      });
    }

    // Pre-checks so we don't create a driver we'd have to roll back
    try {
      const vehicleType = await this.resolveVehicleType(vehicleTypeId);

      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }


      const fileUrl = (field) => (files[field]?.[0] ? buildFileUrl(req, files[field][0].filename) : '');
      const vehicleImages = (files.vehicleImages || []).map((f) => buildFileUrl(req, f.filename));

      // 1) Create the driver
      const driver = await this.driverService.updateDriver(userid, {
        name,
        email,
        phoneNumber,
        dob,
        gender: gender?.toLowerCase(),
        address,
        aadharCardNumber: aadharCardNumber || undefined,
        profileImageUrl: fileUrl('profileImage'),
        dlDetails: {
          dlNumber: dlNumber || undefined,
          dlFrontImageUrl: fileUrl('dlFrontImage'),
          dlBackImageUrl: fileUrl('dlBackImage'),
        },
      }, { new: true, upsert: true, setDefaultsOnInsert: true });

      // 2) Create the vehicle — roll the driver back if this fails
      let vehicle;
      try {
        vehicle = await this.vehicleService.createVehicle({
          driverId: driver._id,
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
          rcDetails: {
            frontImageUrl: fileUrl('rcFrontImage'),
            backImageUrl: fileUrl('rcBackImage'),
          },
        });
      } catch (vehicleError) {
        // Compensate: remove the just-created driver so we don't leave an orphan
        await this.driverService.deleteDriver(driver._id);
        throw vehicleError;
      }

      return res.status(201).json({
        message: 'Driver onboarded successfully.',
        role: 'driver',
        driver,
        vehicle,
      });
    } catch (error) {
      console.log(error);
      if (isDuplicateKeyError(error)) {
        const { field, label, message } = duplicateKeyInfo(error);
        return res.status(409).json({ message: `${label} already registered`, errors: [{ field, message }] });
      }
      return res.status(500).json({ error: 'Failed to onboard driver', message: 'Internal server error' });
    }
  };

  // Accepts either a VehicleType ObjectId or its slug (e.g. "bharat_mini")
  resolveVehicleType = async (vehicleTypeId) => {
    if (mongoose.isValidObjectId(vehicleTypeId)) {
      return this.vehicleTypeService.getVehicleTypeById(vehicleTypeId);
    }
    return this.vehicleTypeService.getVehicleTypeBySlug(String(vehicleTypeId).toLowerCase());
  };

  // POST /api/v3/drivers/kyc/verify  (protected — driver only)
  // Driver comes from the token; returns a Signzy DigiLocker redirect URL.
  verifyKyc = async (req, res) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber || !String(phoneNumber).trim()) {
        return res.status(400).json({ error: 'Phone number is required' });
      }
      console.log('verifyKyc called with phone:', phoneNumber);
      const callbackUrl = `${env.SIGNZY_CALLBACK_URL}/api/v3/drivers/kyc/callback/${phoneNumber}`;

      const redirectUrl = await this.kycService.createDigilockerUrl(callbackUrl);
      if (!redirectUrl) {
        return res.status(502).json({ error: 'KYC provider did not return a URL' });
      }

      return res.status(200).json({ redirectUrl });
    } catch (error) {
      console.error('Unable to proceed with kyc:', error.response?.data || error.message);
      return res.status(500).json({ error: 'Unable to proceed with kyc' });
    }
  };

  // POST /api/v3/drivers/kyc/callback/:phonenumber  (Signzy webhook — no token)
  completeKyc = async (req, res) => {
    try {
      const { phonenumber } = req.params;
      const data = req.body;

      // create user by phone number
      const dob = data.aadharDetail?.dob
        ? (() => {
          const [day, month, year] = data.aadharDetail.dob.split("/");
          return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
        })()
        : undefined;

      let driver = await this.driverService.createDriver({
        phoneNumber: phonenumber,
        name: data.aadharDetail?.name || "unknown",
        dob,
        aadharCardNumber: data.aadharDetail?.uid || undefined,
        gender: data.aadharDetail?.gender
          ? String(data.aadharDetail.gender).toLowerCase()
          : undefined,
      });

      const { requestId, status, adharFileId, aadhaarJpeg } = this.kycService.parseCallback(req.body);

      if (!requestId || !status || !adharFileId || !aadhaarJpeg) {
        await this.driverService.updateDriver(driver._id, {
          isKycCompleted: false,
          kycFailedReason: 'Invalid KYC Data: missing required fields',
        });
        console.error('Invalid KYC callback data:', req.body);
        return res.status(400).json({ error: 'Invalid KYC callback data' });
      }

      // One KYC document per person: reject if this Aadhaar file is already
      // linked to a different driver.
      if (adharFileId) {
        const owner = await this.driverService.getDriverByKycFileId(adharFileId);
        if (owner && String(owner._id) !== String(driver._id)) {
          await this.driverService.updateDriver(driver._id, {
            isKycCompleted: false,
            name: 'unknown',
            kycDetails: {
              status: 'failed',
            },
            kycFailedReason: 'This KYC document is already linked to another account',
          });
          return res.status(409).json({ error: 'This KYC document is already linked to another account' });
        }
      }

      driver = await this.driverService.updateDriver(driver._id, {
        isKycCompleted: status === 'success',
        kycDetails: { requestId, status, adharFileId, aadhaarJpeg },
      });

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      return res.status(200).json({ message: 'Driver KYC status updated successfully.' });
    } catch (error) {
      console.error('Error in completing driver kyc:', error);
      // Safety net for a race that slips past the pre-check (unique index)
      if (isDuplicateKeyError(error)) {
        await this.driverService.updateDriver(req.params.phonenumber, {
          isKycCompleted: false,
          name: 'unknown',
          kycDetails: {
            status: 'failed',
          },
          kycFailedReason: 'This KYC document is already linked to another account',
        });
        return res.status(409).json({ error: 'This KYC document is already linked to another account' });
      }
      return res.status(500).json({ error: 'Error in completing driver kyc' });
    }
  };

  checkKycStatus = async (req, res) => {
    try {
      const { phonenumber } = req.params;
      const driver = await this.driverService.getDriverByPhone(phonenumber);

      if (!driver) {
        return res.status(404).json({ kycStatus: 'not_found', message: 'Driver not found' });
      }

      if (driver.isKycCompleted) {
        const token = generateToken({ id: driver._id, role: 'driver' });
        return res.status(200).json({ driverId: driver._id, isKycCompleted: driver.isKycCompleted, kycDetails: driver.kycDetails, token: token });
      } else {
        return res.status(200).json({ driverId: driver._id, isKycCompleted: driver.isKycCompleted, kycDetails: driver.kycDetails, kycFailedReason: driver.kycFailedReason });
      }
    } catch (error) {
      console.error('Error in checking driver kyc status:', error);
      return res.status(500).json({ error: 'Error in checking driver kyc status' });
    }
  }
}
