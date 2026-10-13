const { Router } = require('express');
const { dubbingUpload } = require('../middleware/upload');
const cleanupUploads = require('../middleware/cleanupUploads');
const { asyncHandler } = require('../utils/errors');
const { publicUploadUrl } = require('../utils/files');

module.exports = ({ dubbingService }) => {
  const router = Router();

  router.get('/dubbing/languages', (req, res) => {
    res.json({ languages: dubbingService.listLanguages() });
  });

  router.post('/dubbing/create', dubbingUpload.single('media'), cleanupUploads, asyncHandler(async (req, res) => {
    res.json(await dubbingService.create({ file: req.file, body: req.body }));
  }));

  router.get('/dubbing/status/:id', asyncHandler(async (req, res) => {
    res.json(await dubbingService.status(req.params.id));
  }));

  router.get('/dubbing/:id/result/:lang', asyncHandler(async (req, res) => {
    const { filename, media_type } = await dubbingService.fetchResult(req.params.id, req.params.lang);
    res.json({ url: publicUploadUrl(req, filename), filename, media_type });
  }));

  return router;
};
