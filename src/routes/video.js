const { Router } = require('express');
const { asyncHandler } = require('../utils/errors');

// Talking-head (veed/fabric-1.0)
module.exports = ({ videoService }) => {
  const router = Router();

  router.post('/video/generate', asyncHandler(async (req, res) => {
    res.json(await videoService.create(req.body));
  }));

  router.get('/video/status/:id', asyncHandler(async (req, res) => {
    res.json(await videoService.status(req.params.id));
  }));

  return router;
};
