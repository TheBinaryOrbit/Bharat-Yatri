import multer from "multer";
import path from "path";
import fs from "fs";

// Dynamic destination
const vehicleStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "./public/vehicle/others";

    if (file.fieldname === "vehicleImages") {
      folder = "./public/vehicle/images";
    } else if (file.fieldname === "insuranceImage") {
      folder = "./public/vehicle/insurance";
    } else if (file.fieldname === "rcImage") {
      folder = "./public/vehicle/rc";
    }

    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const base = file.originalname.split('.')[0];
    const ext = path.extname(file.originalname);
    cb(null, `${base}-${Date.now()}${ext}`);
  }
});

export const uploadVehicleFiles = multer({
  storage: vehicleStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  
}).fields([
  { name: "vehicleImages", maxCount: 5 },
  { name: "insuranceImage", maxCount: 1 },
  { name: "rcImage", maxCount: 1 } // optional
]);
