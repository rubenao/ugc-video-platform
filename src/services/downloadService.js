const axios = require('axios');
const { HttpError } = require('../utils/errors');

// Proxy de descarga: <a download> no funciona con URLs cross-origin (Replicate, etc.).
class DownloadService {
  async open(url) {
    if (!url) throw new HttpError(400, 'url requerida');
    return axios.get(url, { responseType: 'stream', timeout: 60000 });
  }
}

module.exports = DownloadService;
