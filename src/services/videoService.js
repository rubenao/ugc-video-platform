const fs = require('fs');
const path = require('path');
const { HttpError } = require('../utils/errors');
const { toDataURI, audioToDataURI, uploadFilenameFromUrl } = require('../utils/files');

const MODEL = 'veed/fabric-1.0';

// Talking-head: imagen + audio → video (veed/fabric-1.0 en Replicate).
class VideoService {
  constructor({ replicate, uploadsDir }) {
    this.replicate = replicate;
    this.uploadsDir = uploadsDir;
  }

  async create({ imageUrl, audioFilename }) {
    if (!imageUrl || !audioFilename) {
      throw new HttpError(400, 'imageUrl y audioFilename son requeridos');
    }

    const audioPath = path.join(this.uploadsDir, path.basename(audioFilename));
    if (!fs.existsSync(audioPath)) {
      throw new HttpError(400, 'Archivo de audio no encontrado en el servidor');
    }

    const pred = await this.replicate.createPrediction(MODEL, {
      audio: audioToDataURI(audioPath),
      image: this.resolveImage(imageUrl),
      resolution: '720p'
    });
    return { job_id: pred.id, status: pred.status };
  }

  // Imágenes locales se envían en base64; las externas se usan directamente.
  resolveImage(imageUrl) {
    const filename = uploadFilenameFromUrl(imageUrl);
    if (filename) {
      const imgPath = path.join(this.uploadsDir, filename);
      if (fs.existsSync(imgPath)) return toDataURI(imgPath);
    }
    return imageUrl;
  }

  status(id) {
    return this.replicate.getStatus(id);
  }
}

module.exports = VideoService;
