const SYSTEM = 'Eres un experto en prompts para generación de imágenes con IA (GPT-Image-2). Creas prompts fotorrealistas detallados para retratos de personas reales para contenido UGC. Responde SOLO con el prompt en inglés, sin explicaciones ni comillas.';

const userPrompt = (c) => `Crea un prompt fotorrealista detallado para GPT-Image-2 para generar un avatar UGC con estas características:
Género: ${c.gender || 'neutro'}
Edad: ${c.age || '25-35 años'}
Tono de piel: ${c.skinTone || 'medio'}
Cabello: ${[c.hairColor, c.hairLength, c.hairStyle].filter(Boolean).join(', ') || 'natural'}
Expresión: ${c.expression || 'natural'}
Ropa: ${c.clothing || 'casual'}
Fondo: ${c.background || 'neutro'}

El prompt debe incluir: estilo fotográfico, iluminación, cámara, lente, calidad. La persona debe verse completamente real y auténtica para redes sociales.`;

const templatePrompt = (c) => [
  `photorealistic portrait photo of a ${c.age || '25-35 years old'} ${c.gender || 'person'}`,
  c.skinTone ? c.skinTone : '',
  (c.hairColor && c.hairLength && c.hairStyle) ? `${c.hairColor}, ${c.hairLength}, ${c.hairStyle}` : '',
  c.expression ? c.expression : 'natural expression',
  c.clothing ? `wearing ${c.clothing}` : '',
  c.background ? c.background : 'clean neutral background',
  'authentic UGC content creator style, natural soft lighting, shot on Sony A7R, 85mm lens, photorealistic, 4K, no filters'
].filter(Boolean).join(', ');

const DEFAULT_UGC_PROMPT = 'person holding the product naturally, UGC casual style, authentic photo';

// Instrucción añadida al editar con referencias para conservar la identidad de la persona.
const identityNote = (hasProduct) =>
  `\nThe first reference image is the person: keep the exact same face, facial features, skin tone and hair identity, only change what the description asks for.${
    hasProduct ? ' The second reference image is the product: reproduce its packaging, colors and labels faithfully.' : ''
  }`;

module.exports = { SYSTEM, userPrompt, templatePrompt, DEFAULT_UGC_PROMPT, identityNote };
