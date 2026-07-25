// Maps Mongo duplicate-key (11000) errors to a friendly field + message.
const LABELS = {
  phoneNumber: 'Phone number',
  email: 'Email',
  aadharCardNumber: 'Aadhaar number',
  'dlDetails.dlNumber': 'DL number',
  vehicleNumber: 'Vehicle number',
};

export const isDuplicateKeyError = (error) => error?.code === 11000;

// Returns { field, label, message } for a duplicate-key error
export const duplicateKeyInfo = (error) => {
  const field = Object.keys(error.keyValue || {})[0];
  const label = LABELS[field] || field;
  return { field, label, message: `${label} already exists` };
};
