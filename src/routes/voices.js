const { Router } = require('express');
const { upload } = require('../middleware/upload');
const cleanupUploads = require('../middleware/cleanupUploads');
const { asyncHandler } = require('../utils/errors');

module.exports = ({ voiceService }) => {
  const router = Router();

  router.get('/voices', asyncHandler(async (req, res) => {
    res.json({ voices: await voiceService.list(req.query) });
  }));

  // https://elevenlabs.io/docs/api-reference/voices/add
  router.post('/voices/clone', upload.array('samples', 25), cleanupUploads, asyncHandler(async (req, res) => {
    res.json(await voiceService.clone({ files: req.files || [], body: req.body }));
  }));

  return router;
};
