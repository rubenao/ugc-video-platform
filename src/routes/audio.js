const { Router } = require('express');
const { asyncHandler } = require('../utils/errors');
const { publicUploadUrl } = require('../utils/files');

module.exports = ({ audioService }) => {
  const router = Router();

  router.post('/audio/generate', asyncHandler(async (req, res) => {
    const filename = await audioService.generate(req.body);
    res.json({ audio_url: publicUploadUrl(req, filename), audio_filename: filename });
  }));

  return router;
};
