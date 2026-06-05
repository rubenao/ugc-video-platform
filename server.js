const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// OpenAI SDK (opcional — si no hay API key se usa fallback de plantilla)
let openaiClient = null;
try {
  const OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch { /* SDK no instalado, se usa fallback */ }

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Storage ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- Helpers ----------
function toDataURI(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}

function audioToDataURI(filePath) {
  const data = fs.readFileSync(filePath);
  return `data:audio/mpeg;base64,${data.toString('base64')}`;
}

function serverUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

// Sube un archivo local a Replicate Files API y devuelve la URL pública
async function uploadToReplicateFiles(filePath, mimeType) {
  const filename      = path.basename(filePath);
  const fileBuffer    = fs.readFileSync(filePath);
  const contentLength = fileBuffer.length;

  const response = await axios.post(
    'https://api.replicate.com/v1/files',
    fileBuffer,
    {
      headers: {
        Authorization:         `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type':        mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      contentLength   // requerido para que Replicate no vea body vacío
      },
      maxBodyLength:    Infinity,
      maxContentLength: Infinity,
      timeout: 60000
    }
  );
  return response.data.urls.get;
}

// Si la imagen es de nuestro servidor local, la re-sube a Replicate Files
async function resolvePublicImageUrl(imageUrl) {
  if (!imageUrl) return null;
  // URL externa (ej: replicate.delivery) → usar directamente
  if (!imageUrl.includes('localhost') && !imageUrl.includes('127.0.0.1')) return imageUrl;
  // URL local → leer del disco y subir
  const localMatch = imageUrl.match(/\/uploads\/([^/?#]+)$/);
  if (localMatch) {
    const imgPath = path.join(__dirname, 'uploads', localMatch[1]);
    if (fs.existsSync(imgPath)) return await uploadToReplicateFiles(imgPath, 'image/jpeg');
  }
  return imageUrl;
}

// ---------- VOICES ----------
app.get('/api/voices', async (req, res) => {
  try {
    const r = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    const voices = r.data.voices.map(v => ({
      id: v.voice_id,
      name: v.name,
      preview_url: v.preview_url,
      labels: v.labels
    }));
    res.json({ voices });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ---------- UPLOAD IMAGE (for original person photo) ----------
app.post('/api/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  res.json({ url: serverUrl(req, req.file.filename), filename: req.file.filename });
});

app.post('/api/upload/audio', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió audio' });
  res.json({
    audio_url:      serverUrl(req, req.file.filename),
    audio_filename: req.file.filename
  });
});

// ---------- AVATAR UGC (google/nano-banana-2 con image_input) ----------
app.post('/api/avatar/generate', upload.fields([
  { name: 'personImage', maxCount: 1 },
  { name: 'productImage', maxCount: 1 }
]), async (req, res) => {
  const personFile   = req.files?.personImage?.[0];
  const productFile  = req.files?.productImage?.[0];
  const personImgUrl = req.body.personImageUrl; // URL del avatar generado en Tab 1

  if (!personFile && !personImgUrl) {
    return res.status(400).json({ error: 'Se requiere foto de persona o URL de avatar generado' });
  }

  const userPrompt = req.body.prompt || 'person holding the product naturally, UGC casual style, authentic photo';

  try {
    // Resolver imagen de la persona
    let personDataURI;
    if (personFile) {
      personDataURI = toDataURI(personFile.path);
    } else {
      const imgRes  = await axios.get(personImgUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const mime    = imgRes.headers['content-type'] || 'image/jpeg';
      personDataURI = `data:${mime};base64,${Buffer.from(imgRes.data).toString('base64')}`;
    }

    // Construir image_input: persona siempre primero, producto si está disponible
    const imageInput = [ personDataURI ];
    if (productFile) {
      imageInput.push(toDataURI(productFile.path));
    }

    const prediction = await axios.post(
      'https://api.replicate.com/v1/models/google/nano-banana-2/predictions',
      {
        input: {
          prompt:        userPrompt,
          image_input:   imageInput,
          resolution:    '2K',
          aspect_ratio:  '9:16',
          image_search:  false,
          google_search: false,
          output_format: 'jpg'
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=30'
        },
        timeout: 35000
      }
    );

    // Cleanup
    if (personFile) fs.unlink(personFile.path, () => {});
    if (productFile) fs.unlink(productFile.path, () => {});

    const pred   = prediction.data;
    const output = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    res.json({ prediction_id: pred.id, status: pred.status, output });
  } catch (err) {
    if (personFile) fs.unlink(personFile.path, () => {});
    if (productFile) fs.unlink(productFile.path, () => {});
    console.error('Avatar UGC error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

app.get('/api/replicate/status/:id', async (req, res) => {
  try {
    const r = await axios.get(
      `https://api.replicate.com/v1/predictions/${req.params.id}`,
      { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` } }
    );
    const pred = r.data;
    const output = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    res.json({ status: pred.status, output, error: pred.error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- AUDIO (ElevenLabs) ----------
app.post('/api/audio/generate', async (req, res) => {
  const { text, voiceId, stability = 0.5, similarity = 0.75 } = req.body;
  if (!text || !voiceId) return res.status(400).json({ error: 'text y voiceId son requeridos' });

  try {
    const r = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: parseFloat(stability),
          similarity_boost: parseFloat(similarity),
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `audio-${Date.now()}.mp3`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, Buffer.from(r.data));

    res.json({
      audio_url: serverUrl(req, filename),
      audio_filename: filename
    });
  } catch (err) {
    const detail = err.response?.data;
    const msg = detail ? Buffer.from(detail).toString('utf8') : err.message;
    console.error('Audio error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ---------- VIDEO (veed/fabric-1.0) ----------
app.post('/api/video/generate', async (req, res) => {
  const { imageUrl, audioFilename } = req.body;

  if (!imageUrl || !audioFilename) {
    return res.status(400).json({ error: 'imageUrl y audioFilename son requeridos' });
  }

  const audioPath = path.join(__dirname, 'uploads', audioFilename);
  if (!fs.existsSync(audioPath)) {
    return res.status(400).json({ error: 'Archivo de audio no encontrado en el servidor' });
  }

  try {
    // Convertir audio a base64 data URI (evita subir a un servidor externo)
    const audioDataURI = audioToDataURI(audioPath);

    // Resolver imagen: si es URL externa usarla directamente,
    // si es local convertirla a base64 también
    let imageInput = imageUrl;
    const localMatch = imageUrl.match(/\/uploads\/([^/?#]+)$/);
    if (localMatch) {
      const imgPath = path.join(__dirname, 'uploads', localMatch[1]);
      if (fs.existsSync(imgPath)) imageInput = toDataURI(imgPath);
    }

    const r = await axios.post(
      'https://api.replicate.com/v1/models/veed/fabric-1.0/predictions',
      {
        input: {
          audio:      audioDataURI,
          image:      imageInput,
          resolution: '720p'
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        maxBodyLength:    Infinity,
        maxContentLength: Infinity,
        timeout: 30000
      }
    );

    res.json({ job_id: r.data.id, status: r.data.status });
  } catch (err) {
    console.error('Video error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ---------- SOCIAL: RESEARCH PRODUCT ----------
app.post('/api/social/research', async (req, res) => {
  const { productName, description, url } = req.body;
  if (!productName) return res.status(400).json({ error: 'productName requerido' });

  let urlContent = '';
  if (url) {
    try {
      const pageRes = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
        maxContentLength: 500000
      });
      // Strip HTML tags and get first 3000 chars
      urlContent = pageRes.data
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
    } catch (err) {
      console.warn('URL fetch warning:', err.message);
    }
  }

  if (!openaiClient) {
    const fallback = `Producto: ${productName}\n\n${description || ''}\n\nBeneficios principales:\n- Alta calidad\n- Resultados comprobados\n- Fácil de usar\n\nPúblico objetivo: Personas que buscan soluciones efectivas.\n\nTono sugerido: Cercano, auténtico, inspirador.`;
    return res.json({ productInfo: fallback });
  }

  try {
    const userMsg = `Investiga y resume la información de este producto para crear contenido de redes sociales.

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

    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        { role: 'system', content: 'Eres un experto en marketing de contenidos y copywriting para redes sociales. Analizas productos y generas insights accionables para crear contenido viral.' },
        { role: 'user', content: userMsg }
      ]
    });
    res.json({ productInfo: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error('Research error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- SOCIAL: ANALYZE REFERENCE IMAGE ----------
app.post('/api/social/analyze', upload.single('referenceImage'), async (req, res) => {
  const refFile = req.file;
  if (!refFile) return res.status(400).json({ error: 'Se requiere foto de referencia' });

  if (!openaiClient) {
    fs.unlink(refFile.path, () => {});
    return res.status(400).json({ error: 'OpenAI no configurado' });
  }

  try {
    const refDataURI = toDataURI(refFile.path);

    const analysisCompletion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: 'Eres un director de arte y diseñador gráfico especializado en fotografía de producto y contenido para redes sociales. Analizas imágenes con precisión técnica y creativa.'
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: refDataURI } },
            {
              type: 'text',
              text: `Analiza esta imagen de referencia con detalle técnico y creativo. Incluye:

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

Sé muy específico. Esta descripción se usará para replicar exactamente el estilo y layout de textos, pero con los beneficios del nuevo producto.`
            }
          ]
        }
      ]
    });

    fs.unlink(refFile.path, () => {});
    res.json({ styleAnalysis: analysisCompletion.choices[0].message.content.trim() });
  } catch (err) {
    fs.unlink(refFile.path, () => {});
    console.error('Analyze error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ---------- SOCIAL: GENERATE IMAGE + CAPTION ----------
app.post('/api/social/generate', upload.fields([
  { name: 'referenceImage', maxCount: 1 },
  { name: 'socialProductImage', maxCount: 1 }
]), async (req, res) => {
  const refFile     = req.files?.referenceImage?.[0];
  const productFile = req.files?.socialProductImage?.[0];

  if (!refFile)     return res.status(400).json({ error: 'Se requiere foto de referencia de estilo' });
  if (!productFile) return res.status(400).json({ error: 'Se requiere foto del producto' });

  const {
    productName    = 'el producto',
    productInfo    = '',
    platform       = 'Instagram',
    aspectRatio    = '1:1',
    refinementNotes = '',
    cachedAnalysis  = ''
  } = req.body;

  try {
    const refDataURI     = toDataURI(refFile.path);
    const productDataURI = toDataURI(productFile.path);

    let styleAnalysis = cachedAnalysis || '';
    let imagePrompt   = '';

    if (openaiClient) {
      // Step 1: Analyze reference image — skip if we already have the analysis (refinement)
      if (!styleAnalysis) {
        try {
          const analysisCompletion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 400,
            messages: [
              {
                role: 'system',
                content: 'Eres un director de arte y fotógrafo profesional especializado en fotografía de producto para redes sociales. Analizas imágenes con precisión técnica.'
              },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: refDataURI } },
                  {
                    type: 'text',
                    text: `Analiza esta imagen de referencia con detalle técnico y artístico. Describe:
1. Estilo fotográfico general (lifestyle, flat lay, close-up, overhead, etc.)
2. Iluminación (tipo, dirección, intensidad, sombras)
3. Paleta de colores exacta (colores dominantes, tonos, saturación)
4. Composición y encuadre (centrado, regla de tercios, props, fondos)
5. Mood y atmósfera (minimalista, lujoso, natural, urbano, etc.)
6. Texturas, materiales y superficies del fondo
7. Si hay texto visible, describe su estilo tipográfico y posición

Sé muy específico y técnico. Esta descripción se usará para replicar el estilo exactamente.`
                  }
                ]
              }
            ]
          });
          styleAnalysis = analysisCompletion.choices[0].message.content.trim();
        } catch (err) {
          console.warn('Vision analysis warning:', err.message);
        }
      }

      // Step 2: Build FLUX prompt from style analysis + optional refinement notes
      if (styleAnalysis) {
        try {
          const refinementSection = refinementNotes
            ? `\nAdemás, el usuario quiere estos cambios específicos respecto a la versión anterior:\n"${refinementNotes}"\nAsegúrate de incorporarlos manteniendo el estilo base.`
            : '';

          const promptCompletion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 250,
            messages: [
              {
                role: 'system',
                content: 'Eres un experto en prompts para FLUX AI. Conviertes análisis de estilo en prompts precisos y efectivos para fotografía de producto.'
              },
              {
                role: 'user',
                content: `Tengo este análisis detallado de una imagen de referencia:

${styleAnalysis}

Información del nuevo producto:
- Nombre: ${productName}
- Plataforma destino: ${platform}
${productInfo ? `- Beneficios y descripción: ${productInfo.slice(0, 400)}` : ''}
${refinementSection}

Crea un prompt en inglés para FLUX AI siguiendo estas reglas estrictas:

PRODUCTO: La segunda imagen muestra el producto "${productName}" — reproducirlo con fidelidad 100%: mismo envase, diseño, colores, etiquetas, forma. Sin ninguna alteración al producto.

ESTILO: Replicar exactamente la fotografía, iluminación, composición, paleta de colores y atmósfera del análisis.

TEXTOS EN LA IMAGEN: Si el análisis detectó textos superpuestos (beneficios, encabezados, claims), replicar su layout y posición, reemplazando el contenido con los beneficios reales del nuevo producto "${productName}" en ESPAÑOL. Siempre aplicar este sistema tipográfico uniforme e inamovible:
- Título principal: elegant modern high-contrast luxury serif typeface, bold weight
- Texto secundario / descripciones: clean thin geometric sans-serif, all lowercase
- Líneas indicadoras: clean thin leader lines pointing to the product
- Nunca mezclar estilos ni usar tipografías decorativas fuera de este sistema

PROHIBIDO: personas, modelos, cambiar el producto, cambiar el sistema tipográfico definido.

Responde SOLO con el prompt en inglés, sin explicaciones. Máximo 170 palabras.`
              }
            ]
          });
          imagePrompt = promptCompletion.choices[0].message.content.trim();
        } catch (err) {
          console.warn('Prompt generation warning:', err.message);
        }
      }
    }

    if (!imagePrompt) {
      imagePrompt = `Professional product photography for ${platform}. The second reference image shows the exact product "${productName}" — reproduce it with 100% fidelity: identical packaging, colors, labels, shape, and design, no alterations. Apply the background, surface, props, lighting and color palette from the first reference image. Typography system (uniform, never change): main title uses elegant modern high-contrast luxury serif typeface bold; secondary text and descriptions use clean thin geometric sans-serif all lowercase; clean thin leader lines pointing to the product. All overlay text in Spanish. Preserve original product label text. Studio quality, photorealistic, no people.${refinementNotes ? ' Additional adjustments: ' + refinementNotes : ''}`;
    }

    // Generate image with Replicate
    const prediction = await axios.post(
      'https://api.replicate.com/v1/models/google/nano-banana-2/predictions',
      {
        input: {
          prompt:        imagePrompt,
          image_input:   [refDataURI, productDataURI],
          resolution:    '2K',
          aspect_ratio:  aspectRatio,
          image_search:  false,
          google_search: false,
          output_format: 'jpg'
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=30'
        },
        timeout: 35000
      }
    );

    // Generate caption with OpenAI (in parallel with image polling)
    let caption = '';
    if (openaiClient && productInfo) {
      try {
        const captionCompletion = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 400,
          messages: [
            { role: 'system', content: `Eres un experto copywriter de redes sociales especializado en ${platform}. Escribes copy que convierte y genera engagement.` },
            { role: 'user', content: `Crea un post completo para ${platform} para este producto.

Producto: ${productName}
Información: ${productInfo}

El post debe incluir:
- Hook poderoso (primera línea que engancha)
- Cuerpo persuasivo (beneficios reales, no características)
- Call to action claro
- Hashtags relevantes (10-15 para Instagram/TikTok, 3-5 para LinkedIn)
- Emojis estratégicos

Tono: auténtico, cercano, que venda sin parecer publicidad. Escribe en español.` }
          ]
        });
        caption = captionCompletion.choices[0].message.content.trim();
      } catch (err) {
        console.warn('Caption error:', err.message);
        caption = `¡${productName} es exactamente lo que necesitabas! ✨\n\nDescúbrelo ahora 👇\n\n#producto #lifestyle`;
      }
    } else {
      caption = `¡${productName} es exactamente lo que necesitabas! ✨\n\nDescúbrelo ahora 👇\n\n#producto #lifestyle`;
    }

    // Cleanup
    fs.unlink(refFile.path, () => {});
    fs.unlink(productFile.path, () => {});

    const pred   = prediction.data;
    const output = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    res.json({ prediction_id: pred.id, status: pred.status, output, caption, styleAnalysis });
  } catch (err) {
    if (refFile)     fs.unlink(refFile.path, () => {});
    if (productFile) fs.unlink(productFile.path, () => {});
    console.error('Social generate error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ---------- PROXY DOWNLOAD ----------
// Descarga cualquier URL externa y la reenvía con Content-Disposition attachment
// Necesario porque <a download> no funciona con URLs cross-origin (Replicate, etc.)
app.get('/api/download', async (req, res) => {
  const { url, filename = 'download' } = req.query;
  if (!url) return res.status(400).json({ error: 'url requerida' });

  try {
    const upstream = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000
    });
    const contentType = upstream.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    upstream.data.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/video/status/:id', async (req, res) => {
  try {
    const r = await axios.get(
      `https://api.replicate.com/v1/predictions/${req.params.id}`,
      { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` } }
    );
    const d      = r.data;
    const output = Array.isArray(d.output) ? d.output[0] : d.output;
    res.json({ status: d.status, output, error: d.error });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- PROMPT GENERATION (Tab 1) ----------
function buildPromptFromTemplate(c) {
  const parts = [
    `photorealistic portrait photo of a ${c.age || '25-35 years old'} ${c.gender || 'person'}`,
    c.skinTone  ? c.skinTone : '',
    (c.hairColor && c.hairLength && c.hairStyle) ? `${c.hairColor}, ${c.hairLength}, ${c.hairStyle}` : '',
    c.expression ? c.expression : 'natural expression',
    c.clothing   ? `wearing ${c.clothing}` : '',
    c.background ? c.background : 'clean neutral background',
    'authentic UGC content creator style, natural soft lighting, shot on Sony A7R, 85mm lens, photorealistic, 4K, no filters'
  ];
  return parts.filter(Boolean).join(', ');
}

app.post('/api/prompt/generate', async (req, res) => {
  const { characteristics: c } = req.body;
  if (!c) return res.status(400).json({ error: 'characteristics requerido' });

  // If OpenAI SDK is available, use GPT to craft a better prompt
  if (openaiClient) {
    try {
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en prompts para generación de imágenes con IA (FLUX). Creas prompts fotorrealistas detallados para retratos de personas reales para contenido UGC. Responde SOLO con el prompt en inglés, sin explicaciones ni comillas.'
          },
          {
            role: 'user',
            content: `Crea un prompt fotorrealista detallado para FLUX AI para generar un avatar UGC con estas características:
Género: ${c.gender || 'neutro'}
Edad: ${c.age || '25-35 años'}
Tono de piel: ${c.skinTone || 'medio'}
Cabello: ${[c.hairColor, c.hairLength, c.hairStyle].filter(Boolean).join(', ') || 'natural'}
Expresión: ${c.expression || 'natural'}
Ropa: ${c.clothing || 'casual'}
Fondo: ${c.background || 'neutro'}

El prompt debe incluir: estilo fotográfico, iluminación, cámara, lente, calidad. La persona debe verse completamente real y auténtica para redes sociales.`
          }
        ]
      });
      return res.json({ prompt: completion.choices[0].message.content.trim() });
    } catch (err) {
      console.warn('OpenAI API error, usando plantilla:', err.message);
    }
  }

  // Fallback: template-based prompt
  res.json({ prompt: buildPromptFromTemplate(c) });
});

// ---------- AVATAR FROM TEXT (Tab 1 — google/nano-banana-2) ----------
app.post('/api/avatar/create', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

  try {
    const prediction = await axios.post(
      'https://api.replicate.com/v1/models/google/nano-banana-2/predictions',
      {
        input: {
          prompt,
          resolution:    '2K',
          aspect_ratio:  '9:16',
          image_search:  false,
          google_search: false,
          output_format: 'jpg'
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=30'
        },
        timeout: 35000
      }
    );
    const pred   = prediction.data;
    const output = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    res.json({ prediction_id: pred.id, status: pred.status, output });
  } catch (err) {
    console.error('Create avatar error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.detail || err.message });
  }
});

// ---------- AVATAR GENERATE: accept personImageUrl for Tab 2 when coming from Tab 1 ----------
// (patch: server.js already has /api/avatar/generate with multer; we extend it below via middleware)
// The existing route reads personImage file — we add support for personImageUrl field
// This is handled inside the existing route by checking req.body.personImageUrl

app.listen(PORT, () => {
  console.log(`\n🎬 UGC Video Creator corriendo en http://localhost:${PORT}\n`);
});
