const axios = require('axios');
const { HttpError } = require('../utils/errors');
const { toDataURI } = require('../utils/files');
const { DEFAULT_UGC_PROMPT, identityNote } = require('../prompts/avatar');

const AVATAR_SIZE = '9:16'; // formato vertical para el video talking-head
const AVATAR_RESOLUTION = '2k';

// Avatares con GPT-Image-2 (ApiMart), a través del ImageService compartido.
class AvatarService {
  constructor({ imageService }) {
    this.imageService = imageService;
  }

  createFromPrompt(prompt) {
    if (!prompt) throw new HttpError(400, 'prompt requerido');
    return this.imageService.submit(
      { prompt, size: AVATAR_SIZE, resolution: AVATAR_RESOLUTION },
      'ApiMart avatar create error'
    );
  }

  // Persona (archivo o URL del avatar generado) + producto opcional.
  async generateUGC({ personFile, productFile, personImageUrl, prompt }) {
    if (!personFile && !personImageUrl) {
      throw new HttpError(400, 'Se requiere foto de persona o URL de avatar generado');
    }

    const personDataURI = personFile
      ? toDataURI(personFile.path)
      : await this.downloadAsDataURI(personImageUrl);

    // Persona siempre primero, producto si está disponible.
    const imageUrls = [personDataURI];
    if (productFile) imageUrls.push(toDataURI(productFile.path));

    return this.imageService.submit({
      prompt: (prompt || DEFAULT_UGC_PROMPT) + identityNote(Boolean(productFile)),
      size: AVATAR_SIZE,
      resolution: AVATAR_RESOLUTION,
      imageUrls
    }, 'ApiMart avatar generate error');
  }

  async downloadAsDataURI(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
    const mime = res.headers['content-type'] || 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(res.data).toString('base64')}`;
  }
}

module.exports = AvatarService;
