const { HttpError } = require('../utils/errors');

const FILTER_KEYS = ['gender', 'accent', 'age', 'use_cases', 'language', 'category', 'search'];
const MAX_ACCOUNT_PAGES = 10;

// NOTA: /v2/voices solo devuelve las voces guardadas en la cuenta. Para acentos
// como mexicano/latam hay que consultar la biblioteca pública (/v1/shared-voices).
class VoiceService {
  constructor({ elevenLabs }) {
    this.elevenLabs = elevenLabs;
  }

  async list(query) {
    const params = {};
    FILTER_KEYS.forEach(k => { if (query[k]) params[k] = query[k]; });

    if (query.source === 'account') return this.fetchAccountVoices(params);
    if (query.source === 'library') return this.fetchLibraryVoices(params);

    // Por defecto: cuenta propia + biblioteca pública, sin traer toda la Voice Library.
    const [own, library] = await Promise.all([
      this.fetchAccountVoices(params),
      this.fetchLibraryVoices(params)
    ]);
    const byId = new Map();
    [...own, ...library].forEach(v => byId.set(v.id, v));
    return [...byId.values()];
  }

  async fetchAccountVoices(params) {
    const voices = [];
    let nextPageToken;
    let pages = 0;
    do {
      const page = { ...params, page_size: 100 };
      if (nextPageToken) page.next_page_token = nextPageToken;

      const data = await this.elevenLabs.searchAccountVoices(page);
      voices.push(...data.voices.map(v => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url,
        labels: v.labels,
        source: 'account'
      })));
      nextPageToken = data.has_more ? data.next_page_token : null;
      pages++;
    } while (nextPageToken && pages < MAX_ACCOUNT_PAGES);
    return voices;
  }

  // La paginación por cursor de este endpoint legacy no es fiable: una página grande basta.
  async fetchLibraryVoices(params) {
    const data = await this.elevenLabs.searchSharedVoices({ ...params, page_size: 100 });
    return data.voices.map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      preview_url: v.preview_url,
      labels: {
        accent: v.accent,
        gender: v.gender,
        age: v.age,
        language: v.language,
        use_case: v.use_case,
        descriptive: v.descriptive
      },
      source: 'library'
    }));
  }

  async clone({ files, body }) {
    const { name, description, gender, accent, age, use_case, removeBackgroundNoise } = body;
    if (!name || !name.trim()) throw new HttpError(400, 'El nombre de la voz es requerido');
    if (!files.length) throw new HttpError(400, 'Sube al menos una muestra de audio');

    const labels = {};
    if (gender) labels.gender = gender;
    if (accent) labels.accent = accent;
    if (age) labels.age = age;
    if (use_case) labels.use_case = use_case;

    const data = await this.elevenLabs.addVoice({
      name: name.trim(),
      description: description && description.trim(),
      removeBackgroundNoise: removeBackgroundNoise === 'true',
      labels,
      files
    });
    return { voice_id: data.voice_id, requires_verification: data.requires_verification || false };
  }
}

module.exports = VoiceService;
