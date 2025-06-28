import fs from "fs";
import path from "path";

// Helper to delete image files
export const deleteImageFile = (folder, filename) => {
  if (!filename) return;
  const filePath = path.join(folder, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};