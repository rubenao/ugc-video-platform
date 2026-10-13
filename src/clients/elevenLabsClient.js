const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { upstreamError } = require('../utils/errors');

// Cliente HTTP de ElevenLabs. Solo conoce la API; no contiene reglas de negocio.
class ElevenLabsClient {
  constructor({ apiKey }) {
    this.http = axios.create({
      baseURL: 'https://api.elevenlabs.io',
      headers: { 'xi-api-key': apiKey }
    });
  }

  // GET /v2/voices — solo voces guardadas en la cuenta.
  async searchAccountVoices(params) {
    try {
      const r = await this.http.get('/v2/voices', { params });
      return r.data;
    } catch (err) { throw upstreamError(err); }
  }

  // GET /v1/shared-voices — Voice Library pública (acentos mexicano/latam, etc.).
  async searchSharedVoices(params) {
    try {
      const r = await this.http.get('/v1/shared-voices', { params });
      return r.data;
    } catch (err) { throw upstreamError(err); }
  }

  // POST /v1/text-to-speech/{voiceId} → Buffer mp3
  async textToSpeech(voiceId, body) {
    try {
      const r = await this.http.post(`/v1/text-to-speech/${voiceId}`, body, {
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        responseType: 'arraybuffer',
        timeout: 30000
      });
      return Buffer.from(r.data);
    } catch (err) { throw upstreamError(err, 'Audio error'); }
  }

  // POST /v1/voices/add — Instant Voice Cloning
  async addVoice({ name, description, removeBackgroundNoise, labels, files }) {
    const form = new FormData();
    form.append('name', name);
    if (description) form.append('description', description);
    if (removeBackgroundNoise) form.append('remove_background_noise', 'true');
    if (labels && Object.keys(labels).length) form.append('labels', JSON.stringify(labels));
    files.forEach(f => form.append('files', fs.createReadStream(f.path), f.originalname));

    try {
      const r = await this.http.post('/v1/voices/add', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000
      });
      return r.data;
    } catch (err) { throw upstreamError(err, 'Voice clone error'); }
  }

  // POST /v1/dubbing — crea un proyecto de doblaje (multipart)
  async createDubbing({ file, fields }) {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
    });
    form.append('file', fs.createReadStream(file.path), file.originalname);

    try {
      const r = await this.http.post('/v1/dubbing', form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 5 * 60 * 1000
      });
      return r.data;
    } catch (err) { throw upstreamError(err, 'Dubbing create error'); }
  }

  // GET /v1/dubbing/{id}
  async getDubbing(dubbingId) {
    try {
      const r = await this.http.get(`/v1/dubbing/${encodeURIComponent(dubbingId)}`);
      return r.data;
    } catch (err) { throw upstreamError(err); }
  }

  // GET /v1/dubbing/{id}/audio/{lang} → stream (mp3 o mp4)
  async getDubbedMedia(dubbingId, languageCode) {
    try {
      return await this.http.get(
        `/v1/dubbing/${encodeURIComponent(dubbingId)}/audio/${encodeURIComponent(languageCode)}`,
        { responseType: 'stream', timeout: 5 * 60 * 1000 }
      );
    } catch (err) { throw upstreamError(err, 'Dubbing download error'); }
  }
}

module.exports = ElevenLabsClient;
