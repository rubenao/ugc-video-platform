const { Router } = require('express');
const { upload } = require('../middleware/upload');
const { HttpError } = require('../utils/errors');
const { publicUploadUrl } = require('../utils/files');

// Estos archivos se sirven luego desde /uploads, por eso no se limpian al responder.
module.exports = () => {
  const router = Router();

  router.post('/upload/image', upload.single('image'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió imagen');
    res.json({ url: publicUploadUrl(req, req.file.filename), filename: req.file.filename });
  });

  router.post('/upload/audio', upload.single('audio'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'No se recibió audio');
    res.json({
      audio_url: publicUploadUrl(req, req.file.filename),
      audio_filename: req.file.filename
    });
  });

  return router;
};
