const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { HttpError } = require('../utils/errors');
const { ensureDir } = require('../utils/files');

// Doblaje de audio/video a otro idioma conservando la voz del hablante
// (ElevenLabs Dubbing: POST /v1/dubbing → GET /v1/dubbing/{id} → GET /v1/dubbing/{id}/audio/{lang}).
class DubbingService {
  constructor({ elevenLabs, uploadsDir, languages }) {
    this.elevenLabs = elevenLabs;
    this.uploadsDir = uploadsDir;
    this.languages = languages;
  }

  listLanguages() {
    return this.languages;
  }

  assertLanguage(code) {
    if (!this.languages.some(l => l.code === code)) {
      throw new HttpError(400, `Idioma destino no soportado: ${code}`);
    }
  }

  async create({ file, body }) {
    if (!file) throw new HttpError(400, 'Sube un archivo de audio o video');

    const targetLang = body.target_lang || this.languages[0].code;
    this.assertLanguage(targetLang);

    const sourceLang = body.source_lang && body.source_lang !== 'auto' ? body.source_lang : undefined;
    const data = await this.elevenLabs.createDubbing({
      file,
      fields: {
        target_lang: targetLang,
        source_lang: sourceLang,
        name: file.originalname,
        num_speakers: parseInt(body.num_speakers) || 0,
        drop_background_audio: body.drop_background_audio === 'true'
      }
    });
    return { dubbing_id: data.dubbing_id, expected_duration_sec: data.expected_duration_sec };
  }

  // Normaliza el estado al mismo vocabulario que el resto de módulos.
  async status(dubbingId) {
    const d = await this.elevenLabs.getDubbing(dubbingId);
    let status = 'processing';
    if (d.status === 'dubbed') status = 'succeeded';
    else if (d.status === 'failed' || d.error) status = 'failed';
    return { status, raw_status: d.status, error: d.error || null };
  }

  // Descarga el resultado a uploads/ para poder reproducirlo y reutilizarlo.
  async fetchResult(dubbingId, languageCode) {
    this.assertLanguage(languageCode);

    const res = await this.elevenLabs.getDubbedMedia(dubbingId, languageCode);
    const contentType = String(res.headers['content-type'] || '');
    const isVideo = contentType.includes('video');
    const ext = isVideo ? 'mp4' : 'mp3';

    const safeId = String(dubbingId).replace(/[^\w-]/g, '');
    const filename = `dub-${safeId}-${languageCode}.${ext}`;
    await pipeline(res.data, fs.createWriteStream(path.join(ensureDir(this.uploadsDir), filename)));

    return { filename, media_type: isVideo ? 'video' : 'audio' };
  }
}

module.exports = DubbingService;
