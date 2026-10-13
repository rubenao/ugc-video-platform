const fs = require('fs');
const path = require('path');
const { HttpError } = require('../utils/errors');
const { toDataURI } = require('../utils/files');
const { fetchPageText } = require('../utils/html');
const prompts = require('../prompts/brochure');

const MAX_RESEARCH_URLS = 8;

// Folletos/fichas: igual que la generación de imágenes, pero adjunta opcionalmente
// los logos oficiales de DrMiz LAB y/o DrMiz Farma como referencia.
class BrochureService {
  constructor({ imageService, llm, logosDir }) {
    this.imageService = imageService;
    this.llm = llm;
    this.brandLogos = {
      lab: { path: path.join(logosDir, 'drmizlab-logo.png'), name: 'DrMiz LAB' },
      farma: { path: path.join(logosDir, 'drmizfarma-logo.png'), name: 'DrMiz Farma' }
    };
  }

  generate({ files = [], body }) {
    const { prompt, size = '3:4', resolution = '4k', logoLab, logoFarma } = body;

    const basePrompt = (prompt || '').trim();
    if (!basePrompt) throw new HttpError(400, 'El prompt es requerido');

    const logos = [
      ...(logoLab === 'true' ? [this.brandLogos.lab] : []),
      ...(logoFarma === 'true' ? [this.brandLogos.farma] : [])
    ].filter(l => fs.existsSync(l.path));

    return this.imageService.submit({
      prompt: basePrompt + prompts.logoNote(logos),
      size,
      resolution,
      imageUrls: [...files.map(f => toDataURI(f.path)), ...logos.map(l => toDataURI(l.path))]
    }, 'ApiMart brochure generate error');
  }

  // Extrae info estructurada de producto desde una o varias URLs.
  async research(urls) {
    const urlList = (Array.isArray(urls) ? urls : String(urls || '').split(/\r?\n/))
      .map(u => u.trim())
      .filter(Boolean)
      .slice(0, MAX_RESEARCH_URLS);

    if (!urlList.length) throw new HttpError(400, 'Debes proporcionar al menos una URL de producto');

    const pages = [];
    for (const url of urlList) pages.push({ url, text: await fetchPageText(url) });

    if (!pages.some(pg => pg.text)) {
      throw new HttpError(400, 'No se pudo leer contenido de ninguna de las URLs proporcionadas');
    }

    if (!this.llm.available) return prompts.researchFallback(pages);

    return this.llm.complete({
      system: prompts.SYSTEM,
      user: prompts.researchPrompt(pages),
      maxTokens: 900
    });
  }
}

module.exports = BrochureService;
