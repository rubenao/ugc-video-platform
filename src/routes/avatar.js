const { Router } = require('express');
const { upload } = require('../middleware/upload');
const cleanupUploads = require('../middleware/cleanupUploads');
const { asyncHandler } = require('../utils/errors');

module.exports = ({ avatarService, promptService }) => {
  const router = Router();

  router.post('/prompt/generate', asyncHandler(async (req, res) => {
    res.json({ prompt: await promptService.generateAvatarPrompt(req.body.characteristics) });
  }));

  router.post('/avatar/create', asyncHandler(async (req, res) => {
    res.json(await avatarService.createFromPrompt(req.body.prompt));
  }));

  router.post('/avatar/generate',
    upload.fields([{ name: 'personImage', maxCount: 1 }, { name: 'productImage', maxCount: 1 }]),
    cleanupUploads,
    asyncHandler(async (req, res) => {
      res.json(await avatarService.generateUGC({
        personFile: req.files?.personImage?.[0],
        productFile: req.files?.productImage?.[0],
        personImageUrl: req.body.personImageUrl, // URL del avatar generado en Tab 1
        prompt: req.body.prompt
      }));
    }));

  return router;
};
