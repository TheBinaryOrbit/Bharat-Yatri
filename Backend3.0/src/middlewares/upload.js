import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// All uploads land in <project root>/uploads
export const UPLOAD_DIR = path.join(__dirname, '../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

// Builds a file filter that accepts only the given extensions/mimetypes
const imageFilter = (pattern, label) => (req, file, cb) => {
  const extOk = pattern.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = pattern.test(file.mimetype);
  if (extOk && mimeOk) {
    return cb(null, true);
  }
  const err = new Error(`Only ${label} files are allowed`);
  err.statusCode = 400;
  cb(err);
};

export const upload = multer({
  storage,
  fileFilter: imageFilter(/jpeg|jpg|png|webp/, 'image (jpeg, jpg, png, webp)'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

// PNG-only uploader (e.g. vehicle-type icons)
export const uploadPng = multer({
  storage,
  fileFilter: imageFilter(/png/, 'PNG image'),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- Convenience middlewares per flow ---

// User registration: a single profile image
export const uploadUserProfile = upload.single('profileImage');

// Vehicle type: a single PNG icon
export const uploadVehicleTypeIcon = uploadPng.single('icon');

// Vehicle registration: up to 3 vehicle images + RC front/back
export const uploadVehicleDocs = upload.fields([
  { name: 'vehicleImages', maxCount: 3 },
  { name: 'rcFrontImage', maxCount: 1 },
  { name: 'rcBackImage', maxCount: 1 },
]);

// Full driver onboarding: driver documents + vehicle documents in one request
export const uploadDriverOnboarding = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'dlFrontImage', maxCount: 1 },
  { name: 'dlBackImage', maxCount: 1 },
  { name: 'vehicleImages', maxCount: 3 },
  { name: 'rcFrontImage', maxCount: 1 },
  { name: 'rcBackImage', maxCount: 1 },
]);
