// ============================================================
// State
// ============================================================
const state = {
  createdAvatarUrl: null,
  avatar: { imageUrl: null },
  audio:  { audioUrl: null, audioFilename: null },
  video:  { videoUrl: null },
  social: { imageUrl: null, styleAnalysis: '' }
};

const TAB_NAMES = { 1: 'Crear Avatar', 2: 'Avatar UGC', 3: 'Audio', 4: 'Video', 5: 'Post Social' };

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadVoices();
  initUpload('person-image', 'person-area', 'person-placeholder', 'person-preview');
  initUpload('product-image', 'product-area', 'product-placeholder', 'product-preview');
  initUpload('ref-image', 'ref-area', 'ref-placeholder', 'ref-preview');
  initUpload('soc-product-image', 'soc-product-area', 'soc-product-placeholder', 'soc-product-preview');
  initCharCounter();
  initChips();
  initTab4Uploads();
  goToTab(1);
});

// ============================================================
// Tab navigation
// ============================================================
function goToTab(n) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.tab) === n) item.classList.add('active');
  });

  document.getElementById('topbar-title').textContent = TAB_NAMES[n];

  // Sync previews when entering a tab
  if (n === 2 && state.createdAvatarUrl) {
    document.getElementById('created-avatar-banner-img').src = state.createdAvatarUrl;
    document.getElementById('created-avatar-banner').hidden = false;
  }
  if (n === 3 && state.avatar.imageUrl) {
    document.getElementById('avatar-context-img').src = state.avatar.imageUrl;
    document.getElementById('avatar-context-banner').hidden = false;
  }
  if (n === 4) {
    if (state.avatar.imageUrl) {
      const prev = document.getElementById('video-img-preview');
      prev.src    = state.avatar.imageUrl;
      prev.hidden = false;
      document.getElementById('asset-img-empty').hidden = true;
      document.getElementById('tab4-img-label').classList.add('has-file');
    }
    if (state.audio.audioUrl) {
      document.getElementById('video-audio-preview').src = state.audio.audioUrl;
      document.getElementById('asset-audio-loaded').hidden = false;
      document.getElementById('asset-audio-empty').hidden  = true;
      document.getElementById('tab4-audio-label').classList.add('has-file');
    }
  }

  document.querySelector('.content').scrollTo({ top: 0, behavior: 'smooth' });
  closeSidebar();
}

// ============================================================
// Sidebar helpers
// ============================================================
function markTabDone(n) {
  const item = document.querySelector(`.nav-item[data-tab="${n}"]`);
  if (item) item.classList.add('done');
}
function setNavSub(n, text) {
  const el = document.getElementById(`nav-sub-${n}`);
  if (el) el.textContent = text;
}
function showProgressItem(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
  document.getElementById('progress-label').style.display = 'block';
}

// ============================================================
// Sidebar mobile toggle
// ============================================================
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ============================================================
// Chip selectors (single-select per group)
// ============================================================
function initChips() {
  document.querySelectorAll('.chip-group').forEach(group => {
    group.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });
  });

  document.querySelectorAll('.skin-group').forEach(group => {
    group.querySelectorAll('.skin-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        group.querySelectorAll('.skin-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
      });
    });
  });
}

function getChipValue(groupId) {
  const el = document.querySelector(`#${groupId} .chip.selected, #${groupId} .skin-swatch.selected`);
  return el ? el.dataset.value : null;
}

function getCharacteristics() {
  return {
    gender:      getChipValue('cg-gender'),
    age:         getChipValue('cg-age'),
    skinTone:    getChipValue('cg-skin'),
    hairColor:   getChipValue('cg-hair-color'),
    hairLength:  getChipValue('cg-hair-length'),
    hairStyle:   getChipValue('cg-hair-style'),
    expression:  getChipValue('cg-expression'),
    clothing:    getChipValue('cg-clothing'),
    background:  getChipValue('cg-background')
  };
}

// ============================================================
// File uploads (drag-drop + click)
// ============================================================
function initUpload(inputId, areaId, placeholderId, previewId) {
  const input = document.getElementById(inputId);
  const area  = document.getElementById(areaId);
  const ph    = document.getElementById(placeholderId);
  const prev  = document.getElementById(previewId);

  function applyFile(file) {
    if (!file?.type.startsWith('image/')) return;
    prev.src = URL.createObjectURL(file);
    prev.hidden = false;
    ph.style.display = 'none';
    area.classList.add('has-file');
  }

  input.addEventListener('change', e => { if (e.target.files[0]) applyFile(e.target.files[0]); });
  area.addEventListener('dragover',  e => { e.preventDefault(); area.style.borderColor = 'var(--primary)'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', e => {
    e.preventDefault(); area.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; applyFile(file); }
  });
}

function setPrompt(text) { document.getElementById('avatar-prompt').value = text; }

// ============================================================
// TAB 1: CREAR AVATAR
// ============================================================
async function generatePrompt() {
  const chars = getCharacteristics();
  const btn   = document.getElementById('gen-prompt-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Generando...';

  try {
    const res  = await fetch('/api/prompt/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characteristics: chars })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generando prompt');
    document.getElementById('avatar-create-prompt').value = data.prompt;
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false; btn.innerHTML = '<span>✨</span> Crear con IA';
  }
}

async function generateCreatedAvatar() {
  const prompt = document.getElementById('avatar-create-prompt').value.trim();

  if (!prompt) {
    // Auto-generate prompt first if empty
    await generatePrompt();
    const newPrompt = document.getElementById('avatar-create-prompt').value.trim();
    if (!newPrompt) { toast('Primero genera o escribe una descripción'); return; }
  }

  const finalPrompt = document.getElementById('avatar-create-prompt').value.trim();
  const btn = document.getElementById('gen-create-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Generando avatar...';
  loading('Generando avatar con Google Nano Banana 2...');

  try {
    const res  = await fetch('/api/avatar/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: finalPrompt })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generando avatar');

    if (data.output) {
      setCreatedAvatarResult(data.output);
    } else if (data.prediction_id) {
      loading('Esperando resultado de Replicate...');
      await pollReplicate(data.prediction_id, url => setCreatedAvatarResult(url));
    }
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false; btn.innerHTML = '<span>🧑‍🎨</span> Generar Avatar';
  }
}

function setCreatedAvatarResult(imageUrl) {
  state.createdAvatarUrl = imageUrl;
  document.getElementById('created-avatar-output').src = imageUrl;
  document.getElementById('created-avatar-result').hidden = false;
  document.getElementById('created-avatar-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// "Añadir producto" → lleva a Tab 2 con la imagen pre-cargada
function useCreatedAvatarForUGC() {
  if (!state.createdAvatarUrl) return;

  // Pre-populate person photo in Tab 2
  const prev = document.getElementById('person-preview');
  const ph   = document.getElementById('person-placeholder');
  const area = document.getElementById('person-area');
  prev.src = state.createdAvatarUrl;
  prev.hidden = false;
  ph.style.display = 'none';
  area.classList.add('has-file');

  // Update sidebar
  markTabDone(1);
  setNavSub(1, 'Avatar creado ✓');
  document.getElementById('prog-created-img').src = state.createdAvatarUrl;
  showProgressItem('prog-created-avatar');

  goToTab(2);
}

// "Usar como avatar final" → salta Tab 2, va directo a Audio
function useCreatedAvatarDirect() {
  if (!state.createdAvatarUrl) return;
  state.avatar.imageUrl = state.createdAvatarUrl;

  markTabDone(1);
  setNavSub(1, 'Avatar creado ✓');
  document.getElementById('prog-created-img').src = state.createdAvatarUrl;
  showProgressItem('prog-created-avatar');

  markTabDone(2);
  setNavSub(2, 'Usando avatar de Tab 1');
  document.getElementById('prog-avatar-img').src = state.createdAvatarUrl;
  showProgressItem('prog-avatar');

  goToTab(3);
}

// ============================================================
// TAB 2: AVATAR UGC (FLUX Kontext)
// ============================================================
async function generateAvatar() {
  const personInput  = document.getElementById('person-image');
  const productInput = document.getElementById('product-image');
  const prompt       = document.getElementById('avatar-prompt').value.trim();

  // Allow using created avatar URL as person image base
  const hasUpload = personInput.files[0];
  const hasCreated = state.createdAvatarUrl;

  if (!hasUpload && !hasCreated) { toast('Sube la foto de la persona o genera un avatar en Tab 1'); return; }
  if (!prompt)                   { toast('Escribe la descripción del avatar (prompt)'); return; }

  const btn = document.getElementById('gen-avatar-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Generando...';
  loading('Generando avatar UGC con Google Nano Banana 2...');

  try {
    const fd = new FormData();
    if (hasUpload) {
      fd.append('personImage', personInput.files[0]);
    } else {
      // Tell the server to use the URL from Tab 1
      fd.append('personImageUrl', state.createdAvatarUrl);
    }
    if (productInput.files[0]) fd.append('productImage', productInput.files[0]);
    fd.append('prompt', prompt);

    const res  = await fetch('/api/avatar/generate', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generando avatar');

    if (data.output) {
      setAvatarResult(data.output);
    } else if (data.prediction_id) {
      loading('Esperando resultado de Replicate...');
      await pollReplicate(data.prediction_id, url => setAvatarResult(url));
    }
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false; btn.innerHTML = '<span>✨</span> Generar con IA';
  }
}

async function useOriginalPhoto() {
  const personInput = document.getElementById('person-image');
  const sourceUrl   = state.createdAvatarUrl;

  if (!personInput.files[0] && !sourceUrl) { toast('No hay foto cargada ni avatar creado'); return; }

  if (personInput.files[0]) {
    loading('Subiendo imagen...');
    try {
      const fd = new FormData();
      fd.append('image', personInput.files[0]);
      const res  = await fetch('/api/upload/image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAvatarResult(data.url);
    } catch (err) {
      toast(err.message);
    } finally {
      hideLoading();
    }
  } else {
    setAvatarResult(sourceUrl);
  }
}

function setAvatarResult(imageUrl) {
  state.avatar.imageUrl = imageUrl;
  document.getElementById('avatar-output').src = imageUrl;
  document.getElementById('avatar-result').hidden = false;
  document.getElementById('avatar-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function confirmAvatar() {
  if (!state.avatar.imageUrl) { toast('Genera primero el avatar'); return; }
  markTabDone(2);
  setNavSub(2, 'Avatar listo ✓');
  document.getElementById('prog-avatar-img').src = state.avatar.imageUrl;
  showProgressItem('prog-avatar');
  goToTab(3);
}

// ============================================================
// TAB 3: AUDIO
// ============================================================
async function loadVoices() {
  try {
    const res  = await fetch('/api/voices');
    const data = await res.json();
    const sel  = document.getElementById('voice-select');
    const btn  = document.getElementById('preview-voice-btn');
    if (data.voices?.length) {
      sel.innerHTML = data.voices.map(v => {
        const label = v.labels?.accent ? `${v.name} (${v.labels.accent})` : v.name;
        return `<option value="${v.id}" data-preview="${v.preview_url || ''}">${label}</option>`;
      }).join('');
      btn.disabled = false;
    } else {
      sel.innerHTML = '<option value="">No se encontraron voces</option>';
    }
  } catch {
    document.getElementById('voice-select').innerHTML = '<option value="">Error al cargar voces</option>';
  }
}

function previewVoice() {
  const sel = document.getElementById('voice-select');
  const url = sel.options[sel.selectedIndex]?.dataset.preview;
  if (url) new Audio(url).play().catch(() => toast('Sin preview disponible'));
  else toast('Esta voz no tiene preview');
}

function initCharCounter() {
  const ta = document.getElementById('script-text');
  ta.addEventListener('input', () => {
    const chars = ta.value.length;
    const words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    document.getElementById('char-count').textContent = chars;
    document.getElementById('duration-est').textContent = Math.round(words / 2.5);
  });
}

async function generateAudio() {
  const text    = document.getElementById('script-text').value.trim();
  const voiceId = document.getElementById('voice-select').value;
  if (!text)    { toast('Escribe el guion del video'); return; }
  if (!voiceId) { toast('Selecciona una voz'); return; }

  const btn = document.getElementById('gen-audio-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Generando audio...';
  loading('Generando voz con ElevenLabs...');

  try {
    const res  = await fetch('/api/audio/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text, voiceId,
        stability:  document.getElementById('stability').value,
        similarity: document.getElementById('similarity').value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generando audio');

    state.audio.audioUrl      = data.audio_url;
    state.audio.audioFilename = data.audio_filename;

    document.getElementById('audio-player').src = data.audio_url;
    document.getElementById('dl-audio').href    = data.audio_url;
    document.getElementById('dl-audio').download = 'audio-ugc.mp3';

    document.getElementById('audio-result').hidden = false;
    document.getElementById('audio-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false; btn.innerHTML = '<span>🎙️</span> Generar Audio';
  }
}

function confirmAudio() {
  if (!state.audio.audioUrl) { toast('Genera primero el audio'); return; }
  markTabDone(3);
  setNavSub(3, 'Audio listo ✓');
  showProgressItem('prog-audio');
  goToTab(4);
}

// ============================================================
// TAB 4: uploads directos de imagen y audio
// ============================================================
function initTab4Uploads() {
  // Imagen
  const imgInput = document.getElementById('tab4-image');
  const imgLabel = document.getElementById('tab4-img-label');
  imgInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    imgLabel.classList.add('has-file');
    loading('Subiendo imagen...');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res  = await fetch('/api/upload/image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      state.avatar.imageUrl = data.url;
      const preview = document.getElementById('video-img-preview');
      preview.src    = data.url;
      preview.hidden = false;
      document.getElementById('asset-img-empty').hidden = true;
    } catch (err) {
      toast(err.message);
    } finally {
      hideLoading();
    }
  });

  // Audio
  const audioInput = document.getElementById('tab4-audio');
  const audioLabel = document.getElementById('tab4-audio-label');
  audioInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    audioLabel.classList.add('has-file');
    loading('Subiendo audio...');
    try {
      const fd = new FormData();
      fd.append('audio', file);
      const res  = await fetch('/api/upload/audio', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      state.audio.audioUrl      = data.audio_url;
      state.audio.audioFilename = data.audio_filename;
      const player = document.getElementById('video-audio-preview');
      player.src   = data.audio_url;
      document.getElementById('asset-audio-loaded').hidden = false;
      document.getElementById('asset-audio-empty').hidden  = true;
    } catch (err) {
      toast(err.message);
    } finally {
      hideLoading();
    }
  });

  // Drag & drop en imagen
  imgLabel.addEventListener('dragover',  e => { e.preventDefault(); imgLabel.style.borderColor = 'var(--primary)'; });
  imgLabel.addEventListener('dragleave', () => { imgLabel.style.borderColor = ''; });
  imgLabel.addEventListener('drop', e => {
    e.preventDefault(); imgLabel.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) {
      const dt = new DataTransfer(); dt.items.add(file);
      imgInput.files = dt.files;
      imgInput.dispatchEvent(new Event('change'));
    }
  });

  // Drag & drop en audio
  audioLabel.addEventListener('dragover',  e => { e.preventDefault(); audioLabel.style.borderColor = 'var(--primary)'; });
  audioLabel.addEventListener('dragleave', () => { audioLabel.style.borderColor = ''; });
  audioLabel.addEventListener('drop', e => {
    e.preventDefault(); audioLabel.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('audio/')) {
      const dt = new DataTransfer(); dt.items.add(file);
      audioInput.files = dt.files;
      audioInput.dispatchEvent(new Event('change'));
    }
  });
}

// ============================================================
// TAB 4: VIDEO
// ============================================================
async function generateVideo() {
  if (!state.avatar.imageUrl)     { toast('Falta el avatar — ve a Tab 1 o 2'); return; }
  if (!state.audio.audioFilename) { toast('Falta el audio — ve a Tab 3'); return; }

  const btn = document.getElementById('gen-video-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Iniciando...';
  loading('Enviando a veed/fabric-1.0...');

  try {
    const res  = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: state.avatar.imageUrl, audioFilename: state.audio.audioFilename })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error iniciando generación de video');

    hideLoading();
    btn.style.display = 'none';
    document.getElementById('video-progress').hidden = false;
    await pollVideo(data.job_id);
  } catch (err) {
    toast(err.message);
    document.getElementById('video-progress').hidden = true;
    btn.disabled = false; btn.style.display = '';
    btn.innerHTML = '<span>🎬</span> Generar Video UGC';
    hideLoading();
  }
}

const STATUS_MSGS = [
  'Generando video... esto puede tomar 1-3 minutos',
  'Analizando la imagen del avatar...',
  'Animando el rostro con IA...',
  'Sincronizando labios con el audio...',
  'Aplicando mejoras de calidad...',
  'Finalizando el video...',
  'Casi listo...'
];

async function pollVideo(jobId) {
  const statusEl = document.getElementById('progress-text');
  let attempt = 0;
  while (attempt < 120) {
    await sleep(5000);
    attempt++;
    if (attempt < STATUS_MSGS.length) statusEl.textContent = STATUS_MSGS[attempt];
    try {
      const res  = await fetch(`/api/video/status/${jobId}`);
      const data = await res.json();
      if (data.status === 'succeeded' && data.output) { showVideoResult(data.output); return; }
      if (data.status === 'failed') throw new Error(data.error || 'Falló la generación del video');
    } catch (err) {
      if (err.message.includes('Falló')) throw err;
    }
  }
  throw new Error('Tiempo de espera agotado. Intenta de nuevo.');
}

function showVideoResult(videoUrl) {
  state.video.videoUrl = videoUrl;
  document.getElementById('video-progress').hidden = true;

  document.getElementById('video-player').src = videoUrl;

  document.getElementById('video-result').hidden = false;
  document.getElementById('video-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  markTabDone(4);
  setNavSub(4, 'Video listo ✓');
  showProgressItem('prog-video');
  toast('¡Video UGC generado! 🎉', 'success');
}

// ============================================================
// Replicate polling helper
// ============================================================
async function pollReplicate(predId, onSuccess) {
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const res  = await fetch(`/api/replicate/status/${predId}`);
    const data = await res.json();
    if (data.status === 'succeeded' && data.output) { onSuccess(data.output); return; }
    if (data.status === 'failed') throw new Error(data.error || 'Falló en Replicate');
  }
  throw new Error('Tiempo de espera agotado en Replicate');
}

// ============================================================
// UI helpers
// ============================================================
function loading(text = 'Procesando...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-overlay').classList.add('visible');
}
function hideLoading() { document.getElementById('loading-overlay').classList.remove('visible'); }

function toast(msg, type = 'error') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// TAB 5: SOCIAL POST CREATOR
// ============================================================
async function analyzeReference() {
  const refInput = document.getElementById('ref-image');
  if (!refInput.files[0]) { toast('Sube primero la foto de referencia'); return; }

  const btn = document.getElementById('analyze-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Analizando...';
  loading('Analizando imagen de referencia con IA...');

  try {
    const fd = new FormData();
    fd.append('referenceImage', refInput.files[0]);

    const res  = await fetch('/api/social/analyze', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al analizar la imagen');

    state.social.styleAnalysis = data.styleAnalysis;
    document.getElementById('style-analysis-text').value = data.styleAnalysis;

    const card = document.getElementById('analysis-result');
    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast('Análisis completado', 'success');
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.innerHTML = '<span>🔎</span> Analizar imagen de referencia';
  }
}

async function researchProduct() {
  const productName = document.getElementById('soc-product-name').value.trim();
  if (!productName) { toast('Escribe el nombre del producto primero'); return; }

  const btn = document.getElementById('research-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Investigando...';
  loading('Investigando el producto con IA...');

  try {
    const res = await fetch('/api/social/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName,
        description: document.getElementById('soc-product-desc').value.trim(),
        url: document.getElementById('soc-product-url').value.trim()
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al investigar producto');

    document.getElementById('product-info-text').value = data.productInfo;
    const result = document.getElementById('research-result');
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast('Producto investigado exitosamente', 'success');
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.innerHTML = '<span>🔍</span> Investigar producto con IA';
  }
}

async function generateSocialPost() {
  const refInput     = document.getElementById('ref-image');
  const productInput = document.getElementById('soc-product-image');
  const productName  = document.getElementById('soc-product-name').value.trim();

  if (!refInput.files[0])     { toast('Sube una foto de referencia de estilo'); return; }
  if (!productInput.files[0]) { toast('Sube una foto del producto'); return; }
  if (!productName)            { toast('Escribe el nombre del producto'); return; }

  const btn = document.getElementById('gen-social-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Generando...';

  // Auto-run analysis if not done yet
  const analysisText = document.getElementById('style-analysis-text').value.trim();
  if (!analysisText) {
    loading('Analizando imagen de referencia...');
    try {
      const fd = new FormData();
      fd.append('referenceImage', refInput.files[0]);
      const res  = await fetch('/api/social/analyze', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      state.social.styleAnalysis = data.styleAnalysis;
      document.getElementById('style-analysis-text').value = data.styleAnalysis;
      document.getElementById('analysis-result').hidden = false;
    } catch (err) {
      toast('Error al analizar referencia: ' + err.message);
      btn.disabled = false;
      btn.innerHTML = '<span>✨</span> Generar Foto + Copy del Post';
      hideLoading();
      return;
    }
  }

  // Auto-run research if not done yet
  const productInfoText = document.getElementById('product-info-text').value.trim();
  if (!productInfoText) {
    loading('Investigando el producto...');
    try {
      const res  = await fetch('/api/social/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName,
          description: document.getElementById('soc-product-desc').value.trim(),
          url: document.getElementById('soc-product-url').value.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('product-info-text').value = data.productInfo;
      document.getElementById('research-result').hidden = false;
    } catch (err) {
      console.warn('Auto-research failed:', err.message);
      // Non-blocking — continue without product info
    }
  }

  loading('Generando foto profesional con Google Nano Banana 2...');

  try {
    const fd = new FormData();
    fd.append('referenceImage',     refInput.files[0]);
    fd.append('socialProductImage', productInput.files[0]);
    fd.append('productName',        productName);
    fd.append('productInfo',        document.getElementById('product-info-text').value.trim());
    fd.append('platform',           getChipValue('cg-platform') || 'Instagram');
    fd.append('aspectRatio',        getChipValue('cg-aspect')   || '1:1');
    fd.append('refinementNotes',    document.getElementById('refinement-notes').value.trim());
    // Use the editable textarea value so manual edits are respected
    const analysisFromUI = document.getElementById('style-analysis-text').value.trim();
    fd.append('cachedAnalysis', analysisFromUI || state.social.styleAnalysis);

    const res  = await fetch('/api/social/generate', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generando el post');

    if (data.output) {
      setSocialResult(data.output, data.caption, data.styleAnalysis);
    } else if (data.prediction_id) {
      loading('Esperando resultado de Replicate...');
      await pollReplicate(data.prediction_id, url => setSocialResult(url, data.caption, data.styleAnalysis));
    }
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false;
    btn.innerHTML = '<span>✨</span> Generar Foto + Copy del Post';
  }
}

function setSocialResult(imageUrl, caption, styleAnalysis) {
  state.social.imageUrl      = imageUrl;
  if (styleAnalysis) {
    state.social.styleAnalysis = styleAnalysis;
    document.getElementById('style-analysis-text').value = styleAnalysis;
  }

  document.getElementById('social-output-img').src = imageUrl;
  document.getElementById('social-caption').value  = caption || '';
  document.getElementById('refinement-notes').value = '';

  const result = document.getElementById('social-result');
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  markTabDone(5);
  setNavSub(5, 'Post generado ✓');
  toast('¡Post generado! 🎉', 'success');
}

function copySocialCaption() {
  const text = document.getElementById('social-caption').value;
  if (!text) { toast('No hay texto para copiar'); return; }
  navigator.clipboard.writeText(text)
    .then(() => toast('Texto copiado al portapapeles', 'success'))
    .catch(() => toast('Error al copiar — selecciónalo manualmente'));
}

async function downloadAsset(url, filename) {
  if (!url) { toast('No hay archivo para descargar'); return; }
  try {
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href     = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    toast('Error al descargar: ' + err.message);
  }
}
