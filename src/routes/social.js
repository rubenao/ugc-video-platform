const { Router } = require('express');
const { upload } = require('../middleware/upload');
const cleanupUploads = require('../middleware/cleanupUploads');
const { asyncHandler } = require('../utils/errors');

module.exports = ({ socialService }) => {
  const router = Router();

  router.post('/social/research', asyncHandler(async (req, res) => {
    res.json({ productInfo: await socialService.research(req.body) });
  }));

  router.post('/social/analyze', upload.single('referenceImage'), cleanupUploads, asyncHandler(async (req, res) => {
    res.json({ styleAnalysis: await socialService.analyze(req.file) });
  }));

  router.post('/social/generate',
    upload.fields([{ name: 'referenceImage', maxCount: 1 }, { name: 'socialProductImage', maxCount: 1 }]),
    cleanupUploads,
    asyncHandler(async (req, res) => {
      res.json(await socialService.generate({
        referenceFile: req.files?.referenceImage?.[0],
        productFile: req.files?.socialProductImage?.[0],
        body: req.body
      }));
    }));

  return router;
};
