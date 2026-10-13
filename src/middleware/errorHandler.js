const multer = require('multer');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(`${req.method} ${req.originalUrl}:`, err.message);
  res.status(status).json({ error: err.message, ...(err.extra || {}) });
}

module.exports = errorHandler;
