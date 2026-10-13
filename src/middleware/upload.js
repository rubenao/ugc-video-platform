const multer = require('multer');
const path = require('path');
const config = require('../config');
const { ensureDir } = require('../utils/files');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ensureDir(config.paths.uploads)),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});

const createUploader = (limitMb) => multer({ storage, limits: { fileSize: limitMb * 1024 * 1024 } });

module.exports = {
  upload: createUploader(config.limits.uploadMb),
  dubbingUpload: createUploader(config.limits.dubbingUploadMb)
};
