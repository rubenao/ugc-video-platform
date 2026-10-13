const fs = require('fs');
const path = require('path');
const { HttpError } = require('../utils/errors');
const { ensureDir } = require('../utils/files');

const TTS_MODEL = 'eleven_multilingual_v2';

class AudioService {
  constructor({ elevenLabs, uploadsDir }) {
    this.elevenLabs = elevenLabs;
    this.uploadsDir = uploadsDir;
  }

  // Genera el audio y lo guarda en uploads/. Devuelve el nombre del archivo.
  async generate({ text, voiceId, stability = 0.5, similarity = 0.75 }) {
    if (!text || !voiceId) throw new HttpError(400, 'text y voiceId son requeridos');

    const audio = await this.elevenLabs.textToSpeech(voiceId, {
      text,
      model_id: TTS_MODEL,
      voice_settings: {
        stability: parseFloat(stability),
        similarity_boost: parseFloat(similarity),
        style: 0.0,
        use_speaker_boost: true
      }
    });

    const filename = `audio-${Date.now()}.mp3`;
    fs.writeFileSync(path.join(ensureDir(this.uploadsDir), filename), audio);
    return filename;
  }
}

module.exports = AudioService;
