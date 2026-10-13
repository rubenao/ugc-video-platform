const fs = require('fs');
const path = require('path');

const MIME_BY_EXT = { png: 'image/png', webp: 'image/webp' };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function removeFiles(files) {
  (files || []).filter(Boolean).forEach(f => fs.unlink(f.path, () => {}));
}

function toDataURI(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function audioToDataURI(filePath) {
  return `data:audio/mpeg;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function publicUploadUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

// Devuelve el nombre de archivo si la URL apunta a /uploads/<archivo>, o null.
function uploadFilenameFromUrl(url) {
  const match = String(url || '').match(/\/uploads\/([^/?#]+)$/);
  return match ? match[1] : null;
}

module.exports = { ensureDir, removeFiles, toDataURI, audioToDataURI, publicUploadUrl, uploadFilenameFromUrl };
