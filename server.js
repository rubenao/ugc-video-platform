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
