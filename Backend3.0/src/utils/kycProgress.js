// Where a driver stands in KYC, in the shape every KYC response carries.
//
// Drivers created before kycStatus existed only have isKycCompleted, so fall back to it.
export const kycProgress = (driver) => {
  const status = driver.kycStatus || (driver.isKycCompleted ? 'verified' : 'not_started');

  return {
    status,
    method: driver.kycMethod || null,
    isVerified: status === 'verified',
    // A driver may (re)start KYC unless they are verified. A pending manual request may still be
    // replaced with new photos or skipped in favour of DigiLocker.
    canSubmit: status !== 'verified',
    failedReason: status === 'rejected' ? driver.kycFailedReason || '' : '',
    manual: driver.kycMethod === 'manual' ? driver.manualKyc || null : null,
  };
};
