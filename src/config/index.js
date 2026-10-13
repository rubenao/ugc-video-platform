require('dotenv').config();
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

module.exports = {
  port: process.env.PORT || 3000,

  paths: {
    root: ROOT,
    uploads: path.join(ROOT, 'uploads'),
    public: path.join(ROOT, 'public'),
    logos: path.join(ROOT, 'public', 'assets', 'logos')
  },

  keys: {
    replicate: process.env.REPLICATE_API_TOKEN,
    openai: process.env.OPENAI_API_KEY,
    elevenlabs: process.env.ELEVENLABS_API_KEY,
    apimart: process.env.APIMART_API_KEY
  },

  limits: {
    uploadMb: 15,
    dubbingUploadMb: Number(process.env.DUBBING_MAX_FILE_MB) || 200
  },

  // Idiomas destino disponibles para doblaje. Para añadir otro basta con agregar una entrada.
  dubbingLanguages: [
    { code: 'en', label: 'Inglés' }
  ]
};
