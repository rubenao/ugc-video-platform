const SYSTEM = 'Eres un experto en dermocosmética que extrae y estructura fichas técnicas de productos de skincare a partir de contenido web, de forma precisa y sin inventar datos.';

const researchPrompt = (pages) => `Extrae información de producto de skincare/dermocosmética a partir del contenido de estas páginas web, para usarla en una ficha técnica, brochure o rutina de skincare.

${pages.map((p, i) => `--- Producto ${i + 1} (${p.url}) ---\n${p.text || '(no se pudo leer el contenido de esta URL)'}`).join('\n\n')}

Para cada producto, devuelve en español, en formato de lista clara y compacta (sin markdown de encabezados, listo para pegar en un campo de texto):
- Nombre del producto
- Presentación (tamaño/ml/g si se menciona)
- Activos/ingredientes destacados
- Beneficios principales (máx 5, concretos)
- Modo de uso
- Tipo de piel recomendado (si se menciona)

Sé conciso y factual, usa solo la información disponible en el contenido, no inventes datos que no aparezcan.`;

const researchFallback = (pages) => pages
  .map(p => `Producto (${p.url}):\n${p.text ? p.text.slice(0, 400) : '(sin contenido, completar manualmente)'}`)
  .join('\n\n');

// Instrucción que se añade al prompt para que la IA incluya los logos de marca adjuntos.
const logoNote = (logos) => {
  if (!logos.length) return '';
  const plural = logos.length > 1;
  return `\nIncluye ${plural ? 'los logos de marca proporcionados' : 'el logo de marca proporcionado'} entre las imágenes de referencia (${logos.map(l => l.name).join(' y ')}) reproducido${plural ? 's' : ''} exactamente como se ve${plural ? 'n' : ''}, colocado${plural ? 's' : ''} de forma discreta y profesional (ej. en el encabezado o en la franja inferior junto a los sellos de marca), sin deformarlo${plural ? 's' : ''} ni recolorearlo${plural ? 's' : ''}.`;
};

module.exports = { SYSTEM, researchPrompt, researchFallback, logoNote };
