const { Router } = require('express');
const { asyncHandler } = require('../utils/errors');

module.exports = ({ downloadService }) => {
  const router = Router();

  router.get('/download', asyncHandler(async (req, res) => {
    const { url, filename = 'download' } = req.query;
    const upstream = await downloadService.open(url);

    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    upstream.data.pipe(res);
  }));

  return router;
};
