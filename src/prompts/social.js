const SYSTEM = {
  research: 'Eres un experto en marketing de contenidos y copywriting para redes sociales. Analizas productos y generas insights accionables para crear contenido viral.',
  analyze: 'Eres un director de arte y diseñador gráfico especializado en fotografía de producto y contenido para redes sociales. Analizas imágenes con precisión técnica y creativa.',
  styleBrief: 'Eres un director de arte y fotógrafo profesional especializado en fotografía de producto para redes sociales. Analizas imágenes con precisión técnica.',
  fluxPrompt: 'Eres un experto en prompts para GPT-Image-2. Conviertes análisis de estilo en prompts precisos y efectivos para fotografía de producto.',
  caption: (platform) => `Eres un experto copywriter de redes sociales especializado en ${platform}. Escribes copy que convierte y genera engagement.`
};

const researchFallback = ({ productName, description }) =>
  `Producto: ${productName}\n\n${description || ''}\n\nBeneficios principales:\n- Alta calidad\n- Resultados comprobados\n- Fácil de usar\n\nPúblico objetivo: Personas que buscan soluciones efectivas.\n\nTono sugerido: Cercano, auténtico, inspirador.`;

const researchPrompt = ({ productName, description, urlContent }) => `Investiga y resume la información de este producto para crear contenido de redes sociales.

Nombre: ${productName}
${description ? `Descripción: ${description}` : ''}
${urlContent ? `Contenido de la web del producto:\n${urlContent}` : ''}

Genera un resumen estructurado con:
1. ¿Qué es exactamente el producto?
2. Beneficios principales (máx 5, concretos y persuasivos)
3. Público objetivo ideal
4. Propuesta de valor única / diferenciador
5. Tono recomendado para redes sociales
6. 3 ángulos de contenido (qué historia contar)

Responde en español, directo y orientado a ventas/engagement.`;

const analyzeText = `Analiza esta imagen de referencia con detalle técnico y creativo. Incluye:

**FOTOGRAFÍA Y COMPOSICIÓN**
1. Estilo fotográfico (lifestyle, flat lay, close-up, overhead, etc.)
2. Iluminación (tipo, dirección, intensidad, sombras)
3. Paleta de colores (colores dominantes, tonos, saturación, temperatura)
4. Composición y encuadre (posición del producto, regla de tercios, props, fondos)
5. Texturas y superficies del fondo/entorno
6. Mood y atmósfera (minimalista, lujoso, natural, urbano, etc.)

**TEXTOS Y ELEMENTOS GRÁFICOS** (muy importante)
7. ¿Hay textos superpuestos en la imagen? Describe cada uno:
   - Contenido del texto (encabezados, beneficios, claims, precios, etc.)
   - Posición en la imagen (arriba, abajo, lateral, centrado)
   - Estilo tipográfico (bold, script, sans-serif, tamaño relativo)
   - Color del texto y si tiene fondo o sombra
8. ¿Hay iconos, badges, flechas u otros elementos gráficos?
9. ¿Cuántos bloques de texto hay y cómo están distribuidos?

Sé muy específico. Esta descripción se usará para replicar exactamente el estilo y layout de textos, pero con los beneficios del nuevo producto.`;

const styleBriefText = `Analiza esta imagen de referencia con detalle técnico y artístico. Describe:
1. Estilo fotográfico general (lifestyle, flat lay, close-up, overhead, etc.)
2. Iluminación (tipo, dirección, intensidad, sombras)
3. Paleta de colores exacta (colores dominantes, tonos, saturación)
4. Composición y encuadre (centrado, regla de tercios, props, fondos)
5. Mood y atmósfera (minimalista, lujoso, natural, urbano, etc.)
6. Texturas, materiales y superficies del fondo
7. Si hay texto visible, describe su estilo tipográfico y posición

Sé muy específico y técnico. Esta descripción se usará para replicar el estilo exactamente.`;

const imagePartsPrompt = (dataURI, text) => [
  { type: 'image_url', image_url: { url: dataURI } },
  { type: 'text', text }
];

const fluxPrompt = ({ styleAnalysis, productName, platform, productInfo, refinementNotes }) => {
  const refinementSection = refinementNotes
    ? `\nAdemás, el usuario quiere estos cambios específicos respecto a la versión anterior:\n"${refinementNotes}"\nAsegúrate de incorporarlos manteniendo el estilo base.`
    : '';

  return `Tengo este análisis detallado de una imagen de referencia:

${styleAnalysis}

Información del nuevo producto:
- Nombre: ${productName}
- Plataforma destino: ${platform}
${productInfo ? `- Beneficios y descripción: ${productInfo.slice(0, 400)}` : ''}
${refinementSection}

Crea un prompt en inglés para GPT-Image-2 siguiendo estas reglas estrictas:

PRODUCTO: La segunda imagen muestra el producto "${productName}" — reproducirlo con fidelidad 100%: mismo envase, diseño, colores, etiquetas, forma. Sin ninguna alteración al producto.

ESTILO: Replicar exactamente la fotografía, iluminación, composición, paleta de colores y atmósfera del análisis.

TEXTOS EN LA IMAGEN: Si el análisis detectó textos superpuestos (beneficios, encabezados, claims), replicar su layout y posición, reemplazando el contenido con los beneficios reales del nuevo producto "${productName}" en ESPAÑOL. Siempre aplicar este sistema tipográfico uniforme e inamovible:
- Título principal: elegant modern high-contrast luxury serif typeface, bold weight
- Texto secundario / descripciones: clean thin geometric sans-serif, all lowercase
- Líneas indicadoras: clean thin leader lines pointing to the product
- Nunca mezclar estilos ni usar tipografías decorativas fuera de este sistema

PROHIBIDO: personas, modelos, cambiar el producto, cambiar el sistema tipográfico definido.

Responde SOLO con el prompt en inglés, sin explicaciones. Máximo 170 palabras.`;
};

const imagePromptFallback = ({ platform, productName, refinementNotes }) =>
  `Professional product photography for ${platform}. The second reference image shows the exact product "${productName}" — reproduce it with 100% fidelity: identical packaging, colors, labels, shape, and design, no alterations. Apply the background, surface, props, lighting and color palette from the first reference image. Typography system (uniform, never change): main title uses elegant modern high-contrast luxury serif typeface bold; secondary text and descriptions use clean thin geometric sans-serif all lowercase; clean thin leader lines pointing to the product. All overlay text in Spanish. Preserve original product label text. Studio quality, photorealistic, no people.${refinementNotes ? ' Additional adjustments: ' + refinementNotes : ''}`;

const captionPrompt = ({ platform, productName, productInfo }) => `Crea un post completo para ${platform} para este producto.

Producto: ${productName}
Información: ${productInfo}

El post debe incluir:
- Hook poderoso (primera línea que engancha)
- Cuerpo persuasivo (beneficios reales, no características)
- Call to action claro
- Hashtags relevantes (10-15 para Instagram/TikTok, 3-5 para LinkedIn)
- Emojis estratégicos

Tono: auténtico, cercano, que venda sin parecer publicidad. Escribe en español.`;

const captionFallback = (productName) =>
  `¡${productName} es exactamente lo que necesitabas! ✨\n\nDescúbrelo ahora 👇\n\n#producto #lifestyle`;

module.exports = {
  SYSTEM,
  researchFallback,
  researchPrompt,
  analyzeText,
  styleBriefText,
  imagePartsPrompt,
  fluxPrompt,
  imagePromptFallback,
  captionPrompt,
  captionFallback
};
