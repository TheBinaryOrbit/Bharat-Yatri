import { DriverService } from '../services/driver.service.js';
import { KycService } from '../services/kyc.service.js';
import { VehicleService } from '../services/vehicle.service.js';
import { VehicleTypeService } from '../services/vehicleType.service.js';
import { buildFileUrl } from '../utils/fileUrl.js';
import { resolveVehicleType } from '../utils/resolveVehicleType.js';
import { isDuplicateKeyError, duplicateKeyInfo } from '../utils/duplicateKey.js';
import { notifyDriver } from '../notifications/index.js';
import { env } from '../config/env.js';
import { onboardingProgress } from '../utils/onboardingProgress.js';
import { kycProgress } from '../utils/kycProgress.js';
import { runAtomically } from '../utils/transaction.js';
import { KYC_STATUSES } from '../constants/driver.constants.js';
import mongoose from 'mongoose';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const KYC_ALREADY_LINKED = 'This KYC document is already linked to another account';

// KYC is started from the home screen, so it needs a finished onboarding, and there is nothing
// to do once verified. Returns the response it sent, or undefined when KYC may go ahead.
const kycBlocked = (res, driver) => {
  const onboarding = onboardingProgress(driver);
  if (!onboarding.isComplete) {
    return res.status(409).json({ message: 'Complete onboarding before starting KYC', onboarding });
  }
  const kyc = kycProgress(driver);
  if (kyc.isVerified) {
    return res.status(409).json({ message: 'KYC is already verified', kyc });
  }
  return undefined;
};

// Onboarding steps are for getting a driver to a finished profile. Once it is finished, edits go
// through PATCH /drivers/me and PATCH /vehicles/:id, which do not touch the onboarding state.
const alreadyOnboarded = (res, driver) =>
  res.status(409).json({
    message: 'Onboarding is already complete. Edit your profile instead.',
    onboarding: onboardingProgress(driver),
  });

// A step submitted before the one ahead of it. `onboarding.nextStep` tells the app where to go.
const stepOutOfOrder = (res, driver, message) =>
  res.status(409).json({ message, onboarding: onboardingProgress(driver) });

// Duplicate keys and schema validation failures are the driver's to fix, not a 500.
const onboardingError = (res, error) => {
  console.log(error);
  if (isDuplicateKeyError(error)) {
    const { field, label, message } = duplicateKeyInfo(error);
    return res.status(409).json({ message: `${label} already registered`, errors: [{ field, message }] });
  }
  if (error?.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Some details are invalid',
      errors: Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }
  return res.status(500).json({ error: 'Failed to save onboarding details', message: 'Internal server error' });
};

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

  // GET /api/v3/drivers/onboard/status  (protected — driver only)
  // What the app calls on launch to resume: which step is next, plus everything saved so far so
  // the earlier screens can be shown pre-filled.
  getOnboardingStatus = async (req, res) => {
    try {
      const vehicle = await this.vehicleService.getVehicleByDriver(req.user._id);
      return res.status(200).json({
        onboarding: onboardingProgress(req.user),
        kyc: kycProgress(req.user),
        driver: req.user,
        vehicle,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: 'Failed to fetch onboarding status', message: 'Internal server error' });
    }
  };

  // POST /api/v3/drivers/onboard/personal  (protected — driver only) — step 1 of 3
  // multipart/form-data: name, email, phoneNumber, dob, gender + profileImage
  // Saved on its own, so nothing here is lost if the driver quits before step 2. Re-submitting
  // overwrites the saved values and never moves the driver backwards.
  savePersonalDetails = async (req, res) => {
    const driver = req.user;
    const { name, email, phoneNumber, dob, gender } = req.body;
    const files = req.files || {};

    if (onboardingProgress(driver).isComplete) return alreadyOnboarded(res, driver);

    const errors = [];
    if (!name || !String(name).trim()) errors.push({ field: 'name', message: 'Name is required' });

    if (!dob) {
      errors.push({ field: 'dob', message: 'Date of birth is required' });
    } else if (Number.isNaN(Date.parse(dob))) {
      errors.push({ field: 'dob', message: 'Date of birth must be a valid date (YYYY-MM-DD)' });
    } else if (Date.parse(dob) > Date.now()) {
      errors.push({ field: 'dob', message: 'Date of birth cannot be in the future' });
    }

    // Only required the first time — a re-submit may keep the photo already on file.
    if (!files.profileImage?.[0] && !driver.profileImageUrl) {
      errors.push({ field: 'profileImage', message: 'Profile photo is required' });
    }

    if (gender && !String(gender).match(/^(male|female|other)$/i)) {
      errors.push({ field: 'gender', message: 'Gender must be one of: male, female, other' });
    }

    if (email && !EMAIL_PATTERN.test(String(email).trim())) {
      errors.push({ field: 'email', message: 'Email is invalid' });
    }

    // The number is the account's verified login identity and is never written from the body.
    // It is accepted only so the form can post it; a different number is a mistake, not an edit.
    if (phoneNumber && String(phoneNumber).trim() !== driver.phoneNumber) {
      errors.push({ field: 'phoneNumber', message: 'Phone number must be the one this account was verified with' });
    }

    if (errors.length) {
      return res.status(400).json({ message: 'Invalid personal details', errors });
    }

    const updates = { name: String(name).trim(), dob };
    if (email) updates.email = String(email).trim();
    if (gender) updates.gender = String(gender).toLowerCase();
    if (files.profileImage?.[0]) updates.profileImageUrl = buildFileUrl(req, files.profileImage[0].filename);

    try {
      const updated = await this.driverService.updateDriver(driver._id, {
        $set: updates,
        $max: { onboardingStep: 1 },
      });
      return res.status(200).json({
        message: 'Personal details saved.',
        onboarding: onboardingProgress(updated),
        driver: updated,
      });
    } catch (error) {
      return onboardingError(res, error);
    }
  };

  // POST /api/v3/drivers/onboard/licence  (protected — driver only) — step 2 of 3
  // multipart/form-data: dlNumber + dlFrontImage, dlBackImage
  saveLicenceDetails = async (req, res) => {
    const driver = req.user;
    const files = req.files || {};
    const progress = onboardingProgress(driver);

    if (progress.isComplete) return alreadyOnboarded(res, driver);
    if (progress.completedStep < 1) {
      return stepOutOfOrder(res, driver, 'Complete your personal details before adding your driving licence');
    }

    // As with the photo in step 1, anything already on file may be left out of a re-submit.
    const dlNumber = String(req.body.dlNumber ?? '').trim() || driver.dlDetails?.dlNumber;

    const errors = [];
    if (!dlNumber) errors.push({ field: 'dlNumber', message: 'Driving licence number is required' });
    if (!files.dlFrontImage?.[0] && !driver.dlDetails?.dlFrontImageUrl) {
      errors.push({ field: 'dlFrontImage', message: 'Driving licence front image is required' });
    }
    if (!files.dlBackImage?.[0] && !driver.dlDetails?.dlBackImageUrl) {
      errors.push({ field: 'dlBackImage', message: 'Driving licence back image is required' });
    }
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid driving licence details', errors });
    }

    // Dot notation so a re-submit carrying only one image leaves the other in place
    const updates = { 'dlDetails.dlNumber': dlNumber };
    if (files.dlFrontImage?.[0]) updates['dlDetails.dlFrontImageUrl'] = buildFileUrl(req, files.dlFrontImage[0].filename);
    if (files.dlBackImage?.[0]) updates['dlDetails.dlBackImageUrl'] = buildFileUrl(req, files.dlBackImage[0].filename);

    try {
      const updated = await this.driverService.updateDriver(driver._id, {
        $set: updates,
        $max: { onboardingStep: 2 },
      });
      return res.status(200).json({
        message: 'Driving licence details saved.',
        onboarding: onboardingProgress(updated),
        driver: updated,
      });
    } catch (error) {
      return onboardingError(res, error);
    }
  };

  // POST /api/v3/drivers/onboard/vehicle  (protected — driver only) — step 3 of 3
  // multipart/form-data: vehicle fields + vehicleImages[] (≤3), rcFrontImage, rcBackImage
  // Creates the driver's one vehicle and marks the profile complete, in one transaction.
  saveVehicleDetails = async (req, res) => {
    const driver = req.user;
    const {
      vehicleTypeId, vehicleNumber, vehicleName, ownerName, seatingCapacity,
      manufactureYear, insuranceExpiryMonth, insuranceExpiryYear,
    } = req.body;
    const files = req.files || {};
    const progress = onboardingProgress(driver);

    if (progress.isComplete) return alreadyOnboarded(res, driver);
    if (progress.completedStep < 2) {
      return stepOutOfOrder(res, driver, 'Complete your personal and driving licence details before adding a vehicle');
    }

    const errors = [];
    if (!vehicleTypeId) errors.push({ field: 'vehicleTypeId', message: 'Vehicle type is required' });
    if (!vehicleNumber || !String(vehicleNumber).trim()) {
      errors.push({ field: 'vehicleNumber', message: 'Vehicle number is required' });
    }
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid vehicle details', errors });
    }

    try {
      const vehicleType = await resolveVehicleType(vehicleTypeId);
      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }

      // A vehicle can already exist if it was added through POST /vehicles. The driver owns
      // exactly one, so keep it and finish onboarding rather than fail on the unique index.
      let vehicle = await this.vehicleService.getVehicleByDriver(driver._id);
      const completed = { isProfileComplete: true, onboardingStep: 3 };
      let updated;

      if (vehicle) {
        updated = await this.driverService.updateDriver(driver._id, { $set: completed });
      } else {
        const fileUrl = (field) => (files[field]?.[0] ? buildFileUrl(req, files[field][0].filename) : '');
        await runAtomically(
          async (session) => {
            vehicle = null;
            vehicle = await this.vehicleService.createVehicle({
              driverId: driver._id,
              vehicleTypeId: vehicleType._id,
              vehicleNumber,
              vehicleName,
              ownerName,
              seatingCapacity: seatingCapacity || undefined,
              manufactureYear: manufactureYear || undefined,
              insuranceExpiry: {
                month: insuranceExpiryMonth ? Number(insuranceExpiryMonth) : undefined,
                year: insuranceExpiryYear ? Number(insuranceExpiryYear) : undefined,
              },
              vehicleImages: (files.vehicleImages || []).map((f) => buildFileUrl(req, f.filename)),
              rcDetails: {
                frontImageUrl: fileUrl('rcFrontImage'),
                backImageUrl: fileUrl('rcBackImage'),
              },
            }, { session });

            updated = await this.driverService.updateDriver(driver._id, { $set: completed }, { session });
          },
          // No transaction (standalone MongoDB): undo the vehicle if the driver update failed.
          async () => {
            if (vehicle) await this.vehicleService.deleteVehicle(vehicle._id);
          }
        );
      }

      return res.status(201).json({
        message: 'Driver onboarded successfully.',
        role: 'driver',
        onboarding: onboardingProgress(updated),
        // Onboarding is done, so the app goes to home, which prompts for this next.
        kyc: kycProgress(updated),
        driver: updated,
        vehicle,
      });
    } catch (error) {
      return onboardingError(res, error);
    }
  };

  // POST /api/v3/drivers/onboard
  // Superseded by the three /onboard/* steps above; kept for app builds that still post it all at once.
  // One multipart call → creates the driver AND their vehicle, returns a JWT.
  // A driver may own exactly one vehicle, so this is the only place it's created.
  // Files: profileImage, dlFrontImage, dlBackImage, vehicleImages[] (≤3), rcFrontImage, rcBackImage
  onboardDriver = async (req, res) => {
    const {
      // driver
      name, email, phoneNumber, dob, gender, address, dlNumber,
      // vehicle
      vehicleTypeId, vehicleNumber, vehicleName, seatingCapacity,
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

    // Pre-checks so the transaction only contains the driver and vehicle writes.
    try {
      const vehicleType = await resolveVehicleType(vehicleTypeId);

      if (!vehicleType) {
        return res.status(404).json({ message: 'Vehicle type not found' });
      }


      const fileUrl = (field) => (files[field]?.[0] ? buildFileUrl(req, files[field][0].filename) : '');
      const vehicleImages = (files.vehicleImages || []).map((f) => buildFileUrl(req, f.filename));

      // What the driver update below overwrites, so it can be put back if the vehicle fails.
      const previous = req.user.toObject();
      const touched = ['name', 'email', 'phoneNumber', 'dob', 'gender', 'address',
        'isProfileComplete', 'onboardingStep', 'profileImageUrl', 'dlDetails'];

      let driver;
      let vehicle;
      await runAtomically(
        async (session) => {
          driver = await this.driverService.updateDriver(userid, {
            name,
            email,
            phoneNumber,
            dob,
            gender: gender?.toLowerCase(),
            address,
            isProfileComplete: true,
            onboardingStep: 3,
            profileImageUrl: fileUrl('profileImage'),
            dlDetails: {
              dlNumber: dlNumber || undefined,
              dlFrontImageUrl: fileUrl('dlFrontImage'),
              dlBackImageUrl: fileUrl('dlBackImage'),
            },
          }, {
            upsert: true,
            setDefaultsOnInsert: true,
            session,
          });

          vehicle = await this.vehicleService.createVehicle({
            driverId: driver._id,
            vehicleTypeId: vehicleType._id,
            vehicleNumber,
            vehicleName,
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
          }, { session });
        },
        // No transaction (standalone MongoDB): the vehicle is the second write, so if it failed
        // only the driver needs restoring.
        async () => {
          const $set = {};
          const $unset = {};
          for (const key of touched) {
            if (previous[key] === undefined) $unset[key] = '';
            else $set[key] = previous[key];
          }
          await this.driverService.updateDriver(userid, { $set, $unset });
        }
      );

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

  // --- KYC ---------------------------------------------------------------------------------
  // KYC comes after onboarding and is started from the home screen, by one of two methods:
  //   DigiLocker  POST /drivers/kyc/digilocker → Signzy webview → Signzy calls /kyc/callback
  //   Manual      POST /drivers/kyc/manual with Aadhaar front + back photos → an admin reviews

  // GET /api/v3/drivers/kyc/status  (protected — driver only)
  getKycStatus = async (req, res) => {
    return res.status(200).json({
      kyc: kycProgress(req.user),
      onboarding: onboardingProgress(req.user),
    });
  };

  // POST /api/v3/drivers/kyc/digilocker  (protected — driver only), also /kyc/verify
  // Driver comes from the token; returns a Signzy DigiLocker redirect URL.
  verifyKyc = async (req, res) => {
    const driver = req.user;
    const blocked = kycBlocked(res, driver);
    if (blocked) return blocked;

    try {
      const callbackUrl = `${env.SIGNZY_CALLBACK_URL}/api/v3/drivers/kyc/callback/${driver.phoneNumber}`;

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

  // POST /api/v3/drivers/kyc/manual  (protected — driver only)
  // multipart/form-data: aadhaarFrontImage, aadhaarBackImage
  // Puts the driver in the admin review queue. Re-submitting while pending replaces the photos.
  submitManualKyc = async (req, res) => {
    const driver = req.user;
    const files = req.files || {};
    const blocked = kycBlocked(res, driver);
    if (blocked) return blocked;

    const errors = [];
    if (!files.aadhaarFrontImage?.[0]) {
      errors.push({ field: 'aadhaarFrontImage', message: 'Aadhaar front image is required' });
    }
    if (!files.aadhaarBackImage?.[0]) {
      errors.push({ field: 'aadhaarBackImage', message: 'Aadhaar back image is required' });
    }
    if (errors.length) {
      return res.status(400).json({ message: 'Both sides of the Aadhaar card are required', errors });
    }

    try {
      const updated = await this.driverService.updateDriver(driver._id, {
        $set: {
          kycMethod: 'manual',
          kycStatus: 'pending',
          isKycCompleted: false,
          kycFailedReason: '',
          manualKyc: {
            aadhaarFrontImageUrl: buildFileUrl(req, files.aadhaarFrontImage[0].filename),
            aadhaarBackImageUrl: buildFileUrl(req, files.aadhaarBackImage[0].filename),
            submittedAt: new Date(),
          },
        },
      });

      return res.status(200).json({
        message: 'Aadhaar submitted. We will verify it shortly.',
        kyc: kycProgress(updated),
      });
    } catch (error) {
      console.error('Failed to submit manual KYC:', error);
      return res.status(500).json({ error: 'Failed to submit KYC', message: 'Internal server error' });
    }
  };

  // POST /api/v3/drivers/kyc/callback/:phonenumber  (Signzy webhook — no token)
  // The driver already exists: accounts are created at OTP verification, and DigiLocker can only
  // be started by an onboarded driver.
  completeKyc = async (req, res) => {
    const { phonenumber } = req.params;
    let driver;

    try {
      driver = await this.driverService.getDriverByPhone(phonenumber);
      if (!driver) {
        console.error('KYC callback for unknown phone number:', phonenumber);
        return res.status(404).json({ error: 'Driver not found' });
      }

      const data = req.body;
      const { requestId, status, adharFileId, aadhaarJpeg } = this.kycService.parseCallback(data);

      if (!requestId || !status || !adharFileId || !aadhaarJpeg) {
        console.error('Invalid KYC callback data:', { ...data, phonenumber });
        await this.rejectDigilocker(driver, 'Invalid KYC Data: missing required fields');
        return res.status(400).json({ error: 'Invalid KYC callback data' });
      }

      // One KYC document per person: reject if this Aadhaar file is already linked to a different driver.
      const owner = await this.driverService.getDriverByKycFileId(adharFileId);
      if (owner && String(owner._id) !== String(driver._id)) {
        await this.rejectDigilocker(driver, KYC_ALREADY_LINKED, { requestId, status: 'failed' });
        return res.status(409).json({ error: KYC_ALREADY_LINKED });
      }

      // Signzy's own status string: anything other than 'success' is a failure.
      if (status !== 'success') {
        await this.rejectDigilocker(
          driver,
          `DigiLocker verification did not succeed (${status}). Please try again.`,
          { requestId, status }
        );
        return res.status(200).json({ message: 'Driver KYC status updated successfully.' });
      }

      // The profile (name, dob, gender) was entered during onboarding and is left alone. The name
      // on the Aadhaar is kept beside it so the two can be compared.
      const updates = {
        isKycCompleted: true,
        kycStatus: 'verified',
        kycMethod: 'digilocker',
        kycFailedReason: '',
        kycDetails: { requestId, status, adharFileId, aadhaarJpeg, aadhaarName: data.aadharDetail?.name },
      };
      if (data.aadharDetail?.uid) updates.aadharCardNumber = data.aadharDetail.uid;

      driver = await this.driverService.updateDriver(driver._id, { $set: updates });
      notifyDriver(driver._id, 'kyc:verified', {});

      return res.status(200).json({ message: 'Driver KYC status updated successfully.' });
    } catch (error) {
      console.error('Error in completing driver kyc:', error);
      // Safety net for a race that slips past the pre-check (unique index)
      if (isDuplicateKeyError(error) && driver) {
        await this.rejectDigilocker(driver, KYC_ALREADY_LINKED, { status: 'failed' });
        return res.status(409).json({ error: KYC_ALREADY_LINKED });
      }
      return res.status(500).json({ error: 'Error in completing driver kyc' });
    }
  };

  // Records a failed DigiLocker attempt and tells the driver why.
  //
  // A driver who is already verified, or whose manual photos are waiting on review, keeps that
  // status: a failed DigiLocker try should not undo either.
  rejectDigilocker = async (driver, reason, kycDetails) => {
    const current = kycProgress(driver);
    if (current.isVerified) return;

    const updates = { kycFailedReason: reason };
    if (kycDetails) updates.kycDetails = kycDetails;
    if (!(current.status === 'pending' && current.method === 'manual')) {
      Object.assign(updates, { kycStatus: 'rejected', kycMethod: 'digilocker', isKycCompleted: false });
    }

    await this.driverService.updateDriver(driver._id, { $set: updates });
    notifyDriver(driver._id, 'kyc:rejected', { reason });
  };

  // GET /api/v3/drivers/kyc/manual?status=pending  (admin)
  // The manual KYC review queue, oldest first. `status` defaults to pending.
  listManualKycRequests = async (req, res) => {
    const status = req.query.status || 'pending';
    if (!KYC_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${KYC_STATUSES.join(', ')}` });
    }

    try {
      const drivers = await this.driverService.getManualKycRequests(status);
      return res.status(200).json({ count: drivers.length, data: drivers });
    } catch (error) {
      console.error('Failed to fetch manual KYC requests:', error);
      return res.status(500).json({ error: 'Failed to fetch KYC requests', message: 'Internal server error' });
    }
  };

  // PATCH /api/v3/drivers/:id/kyc/review  (admin)
  // body: { decision: 'approve' | 'reject', reason }   — reason is required to reject
  reviewManualKyc = async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body || {};
    const reason = String(req.body?.reason ?? '').trim();

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid driver id' });
    }
    const errors = [];
    if (!['approve', 'reject'].includes(decision)) {
      errors.push({ field: 'decision', message: "Decision must be 'approve' or 'reject'" });
    }
    if (decision === 'reject' && !reason) {
      errors.push({ field: 'reason', message: 'A reason is required to reject' });
    }
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid review', errors });
    }

    const approved = decision === 'approve';

    try {
      // Matching on the pending manual state makes the review one-shot: a second click, or a
      // driver who verified through DigiLocker meanwhile, is not overwritten.
      const driver = await this.driverService.reviewPendingManualKyc(id, {
        kycStatus: approved ? 'verified' : 'rejected',
        isKycCompleted: approved,
        kycFailedReason: approved ? '' : reason,
        'manualKyc.reviewedAt': new Date(),
      });

      if (!driver) {
        const exists = await this.driverService.getDriverById(id);
        if (!exists) return res.status(404).json({ message: 'Driver not found' });
        return res.status(409).json({
          message: 'This driver has no manual KYC request waiting for review',
          kyc: kycProgress(exists),
        });
      }

      if (approved) {
        notifyDriver(driver._id, 'kyc:verified', {});
      } else {
        notifyDriver(driver._id, 'kyc:rejected', { reason });
      }

      return res.status(200).json({
        message: approved ? 'KYC approved.' : 'KYC rejected.',
        driverId: driver._id,
        kyc: kycProgress(driver),
      });
    } catch (error) {
      console.error('Failed to review manual KYC:', error);
      return res.status(500).json({ error: 'Failed to review KYC', message: 'Internal server error' });
    }
  };
}
