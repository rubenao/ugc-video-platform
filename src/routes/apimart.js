const { Router } = require('express');
const { upload } = require('../middleware/upload');
const cleanupUploads = require('../middleware/cleanupUploads');
const { asyncHandler } = require('../utils/errors');

// Rutas respaldadas por ApiMart: imágenes (GPT-Image-2), video (Gemini Omni Flash Ext) y folletos.
module.exports = ({ imageService, videoGenerationService, brochureService }) => {
  const router = Router();

  // ----- Imágenes -----
  router.post('/images/generate', upload.array('refImages', 15), cleanupUploads, asyncHandler(async (req, res) => {
    const { prompt, size, resolution } = req.body;
    res.json(await imageService.generate({ files: req.files, prompt, size, resolution }));
  }));

  router.get('/images/status/:id', asyncHandler(async (req, res) => {
    res.json(await imageService.status(req.params.id));
  }));

  // ----- Video -----
  router.post('/videos/generate',
    upload.fields([{ name: 'refImages', maxCount: 3 }, { name: 'refVideo', maxCount: 1 }]),
    cleanupUploads,
    asyncHandler(async (req, res) => {
      res.json(await videoGenerationService.generate({
        imageFiles: req.files?.refImages,
        videoFiles: req.files?.refVideo,
        body: req.body
      }));
    }));

  router.get('/videos/status/:id', asyncHandler(async (req, res) => {
    res.json(await videoGenerationService.status(req.params.id));
  }));

  // ----- Folletos -----
  router.post('/brochure/generate', upload.array('refImages', 13), cleanupUploads, asyncHandler(async (req, res) => {
    res.json(await brochureService.generate({ files: req.files, body: req.body }));
  }));

  router.post('/brochure/research', asyncHandler(async (req, res) => {
    res.json({ productInfo: await brochureService.research(req.body.urls) });
  }));

  return router;
};
