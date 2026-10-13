const { HttpError } = require('../utils/errors');
const { toDataURI } = require('../utils/files');
const { fetchPageText } = require('../utils/html');
const p = require('../prompts/social');

class SocialService {
  constructor({ llm, imageService }) {
    this.llm = llm;
    this.imageService = imageService;
  }

  async research({ productName, description, url }) {
    if (!productName) throw new HttpError(400, 'productName requerido');

    const urlContent = url ? await fetchPageText(url) : '';

    if (!this.llm.available) return p.researchFallback({ productName, description });

    return this.llm.complete({
      system: p.SYSTEM.research,
      user: p.researchPrompt({ productName, description, urlContent }),
      maxTokens: 600
    });
  }

  async analyze(referenceFile) {
    if (!referenceFile) throw new HttpError(400, 'Se requiere foto de referencia');
    if (!this.llm.available) throw new HttpError(400, 'OpenAI no configurado');

    return this.llm.complete({
      system: p.SYSTEM.analyze,
      user: p.imagePartsPrompt(toDataURI(referenceFile.path), p.analyzeText),
      maxTokens: 600
    });
  }

  async generate({ referenceFile, productFile, body }) {
    if (!referenceFile) throw new HttpError(400, 'Se requiere foto de referencia de estilo');
    if (!productFile) throw new HttpError(400, 'Se requiere foto del producto');

    const {
      productName = 'el producto',
      productInfo = '',
      platform = 'Instagram',
      aspectRatio = '1:1',
      refinementNotes = '',
      cachedAnalysis = ''
    } = body;

    const refDataURI = toDataURI(referenceFile.path);
    const productDataURI = toDataURI(productFile.path);

    // Si ya hay análisis (refinamiento) no se vuelve a analizar la referencia.
    const styleAnalysis = cachedAnalysis || await this.safeStyleAnalysis(refDataURI);
    const imagePrompt =
      await this.safeImagePrompt({ styleAnalysis, productName, platform, productInfo, refinementNotes }) ||
      p.imagePromptFallback({ platform, productName, refinementNotes });

    // Imagen 1 = referencia de estilo, imagen 2 = producto (el prompt se refiere a ellas en ese orden).
    const task = await this.imageService.submit({
      prompt: imagePrompt,
      size: aspectRatio,
      resolution: '2k',
      imageUrls: [refDataURI, productDataURI]
    }, 'ApiMart social generate error');
    const caption = await this.buildCaption({ platform, productName, productInfo });

    return { ...task, caption, styleAnalysis };
  }

  // Los pasos con LLM son best-effort: si fallan se usa el respaldo.
  async safeStyleAnalysis(refDataURI) {
    if (!this.llm.available) return '';
    try {
      return await this.llm.complete({
        system: p.SYSTEM.styleBrief,
        user: p.imagePartsPrompt(refDataURI, p.styleBriefText),
        maxTokens: 400
      });
    } catch (err) {
      console.warn('Vision analysis warning:', err.message);
      return '';
    }
  }

  async safeImagePrompt(args) {
    if (!this.llm.available || !args.styleAnalysis) return '';
    try {
      return await this.llm.complete({
        system: p.SYSTEM.fluxPrompt,
        user: p.fluxPrompt(args),
        maxTokens: 250
      });
    } catch (err) {
      console.warn('Prompt generation warning:', err.message);
      return '';
    }
  }

  async buildCaption({ platform, productName, productInfo }) {
    if (!this.llm.available || !productInfo) return p.captionFallback(productName);
    try {
      return await this.llm.complete({
        system: p.SYSTEM.caption(platform),
        user: p.captionPrompt({ platform, productName, productInfo }),
        maxTokens: 400
      });
    } catch (err) {
      console.warn('Caption error:', err.message);
      return p.captionFallback(productName);
    }
  }
}

module.exports = SocialService;
