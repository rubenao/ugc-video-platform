const { HttpError } = require('../utils/errors');
const { toDataURI } = require('../utils/files');

const DURATIONS = [4, 6, 8, 10];
const RESOLUTIONS = ['360p', '720p', '1080p', '4k'];

// Video con audio vía ApiMart (Gemini Omni Flash Ext).
class VideoGenerationService {
  constructor({ apimart }) {
    this.apimart = apimart;
  }

  generate({ imageFiles = [], videoFiles = [], body }) {
    const { prompt, duration = 6, resolution = '720p', aspect_ratio = '16:9', generation_type } = body;

    if (!prompt || !prompt.trim()) throw new HttpError(400, 'El prompt es requerido');
    if (![0, 1, 3].includes(imageFiles.length)) {
      throw new HttpError(400, 'Debes subir 0, 1 o 3 imágenes de referencia');
    }
    if (videoFiles.length > 1) throw new HttpError(400, 'Máximo 1 video de referencia');

    const payload = {
      model: 'gemini-omni-1.1-flash-ext',
      prompt: prompt.trim(),
      aspect_ratio
    };

    const res = String(resolution).toLowerCase();
    if (RESOLUTIONS.includes(res)) payload.resolution = res;

    if (imageFiles.length) {
      payload.image_urls = imageFiles.map(f => toDataURI(f.path));
      payload.generation_type = generation_type === 'reference' ? 'reference' : 'frame';
    }

    if (videoFiles.length) {
      // `duration` no se puede combinar con video_urls según la API
      payload.video_urls = [toDataURI(videoFiles[0].path)];
    } else {
      const dur = parseInt(duration);
      payload.duration = DURATIONS.includes(dur) ? dur : 6;
    }

    return this.apimart.submit('/videos/generations', payload, 'ApiMart video generate error');
  }

  status(id) {
    return this.apimart.getTask(id, 'videos');
  }
}

module.exports = VideoGenerationService;
