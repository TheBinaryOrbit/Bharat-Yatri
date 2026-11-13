// What a driver did (or had done to their account), as shown on the driver's Activity tab in the
// admin portal. type → [category, title]. The category is the first part of the type.
export const DRIVER_ACTIVITY = {
  'account.created': 'Account created at first OTP sign-in',
  'auth.login': 'Signed in with OTP',
  'auth.login_blocked': 'Sign-in refused — account is blocked',

  'onboarding.personal': 'Onboarding step 1 — personal details saved',
  'onboarding.personal_failed': 'Onboarding step 1 — personal details rejected',
  'onboarding.licence': 'Onboarding step 2 — driving licence saved',
  'onboarding.licence_failed': 'Onboarding step 2 — driving licence rejected',
  'onboarding.vehicle': 'Onboarding step 3 — vehicle saved, onboarding complete',
  'onboarding.vehicle_failed': 'Onboarding step 3 — vehicle details rejected',
  'onboarding.full': 'Onboarded in one go (older app build)',

  'profile.update': 'Profile updated from the app',
  'vehicle.create': 'Vehicle added from the app',
  'vehicle.update': 'Vehicle updated from the app',

  'kyc.digilocker_started': 'KYC — DigiLocker verification started',
  'kyc.digilocker_verified': 'KYC — verified through DigiLocker',
  'kyc.digilocker_failed': 'KYC — DigiLocker verification failed',
  'kyc.manual_submitted': 'KYC — Aadhaar photos uploaded for manual review',
  'kyc.manual_failed': 'KYC — Aadhaar upload rejected',

  'admin.kyc_approved': 'KYC approved by an admin',
  'admin.kyc_rejected': 'KYC rejected by an admin',
  'admin.kyc_completed': 'KYC marked complete by an admin',
  'admin.kyc_status': 'KYC status changed by an admin',
  'admin.profile_update': 'Profile edited by an admin',
  'admin.blocked': 'Account blocked by an admin',
  'admin.unblocked': 'Account unblocked by an admin',
};

export const DRIVER_ACTIVITY_TYPES = Object.keys(DRIVER_ACTIVITY);
export const DRIVER_ACTIVITY_CATEGORIES = ['account', 'auth', 'onboarding', 'profile', 'vehicle', 'kyc', 'admin'];

// Readable names for the multipart file fields, so an upload reads "DL front" not "dlFrontImage".
export const UPLOAD_LABELS = {
  profileImage: 'Profile photo',
  dlFrontImage: 'Driving licence front',
  dlBackImage: 'Driving licence back',
  vehicleImages: 'Vehicle photo',
  rcFrontImage: 'RC front',
  rcBackImage: 'RC back',
  aadhaarFrontImage: 'Aadhaar front',
  aadhaarBackImage: 'Aadhaar back',
};
