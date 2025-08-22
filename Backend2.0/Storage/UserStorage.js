import multer from "multer";
import path from "path";
import fs from "fs";

// Dynamically assign destination based on field name
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folderPath = "";

    switch (file.fieldname) {
      case "userImage":
        folderPath = "./public/userimages";
        break;
      default:
        return cb(new Error("Unknown field name for file upload"));
    }

    // Ensure the folder exists
    fs.mkdirSync(folderPath, { recursive: true });

    cb(null, folderPath);
  },

  filename: function (req, file, cb) {
    const baseName = file.originalname.split(".")[0];
    const ext = path.extname(file.originalname);
    cb(null, `${baseName}-${Date.now()}${ext}`);
  }
});


export const uploadUserFiles = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
}).fields([
    { name: "userImage", maxCount: 1 },
]);
