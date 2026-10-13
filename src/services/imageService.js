const { HttpError } = require('../utils/errors');
const { toDataURI } = require('../utils/files');

// Imágenes con GPT-Image-2 vía ApiMart (https://docs.apimart.ai/en/api-reference/images/gpt-image-2/generation).
// Lo reutilizan los servicios de folletos y social.
class ImageService {
  constructor({ apimart }) {
    this.apimart = apimart;
  }

  // imageUrls: hasta 15 data URIs o URLs de referencia (activa el modo imagen→imagen).
  submit({ prompt, size = '1:1', resolution = '2k', imageUrls = [] }, logLabel = 'ApiMart image generate error') {
    if (!prompt || !prompt.trim()) throw new HttpError(400, 'El prompt es requerido');

    const body = {
      model: 'gpt-image-2',
      prompt: prompt.trim(),
      size,
      resolution: String(resolution).toLowerCase(),
      n: 1 // la API solo admite 1 imagen por petición
    };
    if (imageUrls.length) body.image_urls = imageUrls;

    return this.apimart.submit('/images/generations', body, logLabel);
  }

  generate({ files = [], ...options }) {
    return this.submit({ ...options, imageUrls: files.map(f => toDataURI(f.path)) });
  }

  status(id) {
    return this.apimart.getTask(id, 'images');
  }
}

module.exports = ImageService;
