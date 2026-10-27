// Driver onboarding, in the order the app walks it. A driver's `onboardingStep` is how many of
// these they have finished, so the entry at that index is the step they are due next.
export const ONBOARDING_STEPS = ['personal', 'licence', 'vehicle'];

// Where a driver stands in KYC. KYC happens after onboarding, from the home screen.
//   not_started  nothing submitted yet (or a DigiLocker attempt was abandoned)
//   pending      manual Aadhaar photos uploaded, waiting for an admin to review them
//   verified     DigiLocker succeeded or an admin approved the manual photos
//   rejected     DigiLocker failed or an admin rejected the photos; kycFailedReason says why
export const KYC_STATUSES = ['not_started', 'pending', 'verified', 'rejected'];

// How the driver verified (or is verifying).
export const KYC_METHODS = ['digilocker', 'manual'];
