import multer from "multer";
import fs from "fs";
import path from "path";

const videoUploadDir = path.join("public", "temp", "videos");
if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}

// Memory storage for small files (images like avatars & cover photos)
const memoryStorage = multer.memoryStorage();
const imageUpload = multer({ storage: memoryStorage });

//Disk storage for large files (videos)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoUploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const videoUpload = multer({ storage: diskStorage });

export { imageUpload, videoUpload };
