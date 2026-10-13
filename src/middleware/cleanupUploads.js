const { removeFiles } = require('../utils/files');

// Borra del disco los archivos subidos por multer cuando la respuesta termina
// (con éxito o error). Se usa en rutas cuyos archivos son solo de entrada.
function cleanupUploads(req, res, next) {
  res.on('close', () => {
    const files = [];
    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) files.push(...req.files);
    else if (req.files) Object.values(req.files).forEach(list => files.push(...list));
    removeFiles(files);
  });
  next();
}

module.exports = cleanupUploads;
