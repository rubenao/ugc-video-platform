// ============================================================
// State
// ============================================================
const state = {
  createdAvatarUrl: null,
  avatar: { imageUrl: null },
  audio:  { audioUrl: null, audioFilename: null, allVoices: [] },
  video:  { videoUrl: null },
  social: { imageUrl: null, styleAnalysis: '' },
  image:  { imageUrl: null, refFiles: [] },
  voiceClone: { sampleFiles: [] }
};

const TAB_NAMES = { 1: 'Crear Avatar', 2: 'Avatar UGC', 3: 'Audio', 4: 'Video', 5: 'Post Social', 6: 'Generar Imagen', 7: 'Clonar Voz' };

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadVoices();
  ['voice-filter-gender', 'voice-filter-accent', 'voice-filter-age', 'voice-filter-usecase'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderVoiceOptions);
  });
  document.getElementById('voice-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchVoicesByName(); }
  });
  initUpload('person-image', 'person-area', 'person-placeholder', 'person-preview');
  initUpload('product-image', 'product-area', 'product-placeholder', 'product-preview');
  initUpload('ref-image', 'ref-area', 'ref-placeholder', 'ref-preview');
  initUpload('soc-product-image', 'soc-product-area', 'soc-product-placeholder', 'soc-product-preview');
  initCharCounter();
  initChips();
  initTab4Uploads();
  initImageRefUpload();
  initVoiceCloneUpload();
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

// Refine the generated avatar by changing specific characteristics
async function refineCreatedAvatar() {
  const bgChip         = document.querySelector('#refine-bg .chip.selected');
  const clothingChip   = document.querySelector('#refine-clothing .chip.selected');
  const expressionChip = document.querySelector('#refine-expression .chip.selected');
  const notes          = document.getElementById('avatar-refine-notes').value.trim();

  if (!bgChip && !clothingChip && !expressionChip && !notes) {
    toast('Selecciona algo que cambiar o escribe una nota');
    return;
  }

  function syncMainChip(groupId, value) {
    const group = document.getElementById(groupId);
    const match = [...group.querySelectorAll('.chip')].find(c => c.dataset.value === value);
    if (match) {
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      match.classList.add('selected');
    }
  }

  if (bgChip)         syncMainChip('cg-background', bgChip.dataset.value);
  if (clothingChip)   syncMainChip('cg-clothing',   clothingChip.dataset.value);
  if (expressionChip) syncMainChip('cg-expression', expressionChip.dataset.value);

  // Regenerate the AI prompt from updated characteristics
  await generatePrompt();

  // Append any free-text notes
  if (notes) {
    const el = document.getElementById('avatar-create-prompt');
    el.value = el.value.trimEnd() + '. ' + notes;
  }

  // Regenerate the avatar image
  await generateCreatedAvatar();

  // Reset refinement panel state
  document.querySelectorAll('#refine-bg .chip, #refine-clothing .chip, #refine-expression .chip')
    .forEach(c => c.classList.remove('selected'));
  document.getElementById('avatar-refine-notes').value = '';
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
let currentPreviewAudio = null;

async function loadVoices() {
  try {
    const res  = await fetch('/api/voices');
    const data = await res.json();
    if (data.voices?.length) {
      state.audio.allVoices = data.voices;
      populateVoiceFilterOptions(data.voices);
      renderVoiceOptions();
    } else {
      state.audio.allVoices = [];
      document.getElementById('voice-list').innerHTML = '<p class="char-info">No se encontraron voces</p>';
    }
  } catch {
    state.audio.allVoices = [];
    document.getElementById('voice-list').innerHTML = '<p class="char-info">Error al cargar voces</p>';
  }
}

async function searchVoicesByName() {
  const query = document.getElementById('voice-search').value.trim();
  if (!query) { toast('Escribe un nombre para buscar'); return; }

  const btn = document.getElementById('voice-search-btn');
  btn.disabled = true; btn.textContent = 'Buscando...';
  try {
    const res  = await fetch(`/api/voices?search=${encodeURIComponent(query)}`);
    const data = await res.json();

    const resultsBox = document.getElementById('voice-search-results');
    if (!data.voices?.length) {
      resultsBox.hidden = false;
      resultsBox.innerHTML = `<p class="char-info">Sin resultados para "${query}"</p>`;
      return;
    }

    // Añade los encontrados al catálogo general para que también entren en los filtros
    const byId = new Map((state.audio.allVoices || []).map(v => [v.id, v]));
    data.voices.forEach(v => byId.set(v.id, v));
    state.audio.allVoices = [...byId.values()];
    populateVoiceFilterOptions(state.audio.allVoices);

    resultsBox.hidden = false;
    resultsBox.innerHTML = renderVoiceCards(data.voices);
    renderVoiceOptions();
  } catch {
    toast('Error buscando voces');
  } finally {
    btn.disabled = false; btn.textContent = 'Buscar';
  }
}

function populateVoiceFilterOptions(voices) {
  const fields = [
    { id: 'voice-filter-gender',  key: 'gender' },
    { id: 'voice-filter-accent',  key: 'accent' },
    { id: 'voice-filter-age',     key: 'age' },
    { id: 'voice-filter-usecase', key: 'use_case' }
  ];
  fields.forEach(({ id, key }) => {
    const sel = document.getElementById(id);
    const current = sel.value;
    const values = [...new Set(voices.map(v => v.labels?.[key]).filter(Boolean))].sort();
    const placeholder = sel.options[0]?.outerHTML || '';
    sel.innerHTML = placeholder + values.map(val =>
      `<option value="${val}">${val.charAt(0).toUpperCase() + val.slice(1)}</option>`
    ).join('');
    if (values.includes(current)) sel.value = current;
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function renderVoiceCards(voices) {
  const selectedId = document.getElementById('voice-select').value;
  return voices.map(v => {
    const l = v.labels || {};
    const tags = [l.accent, l.gender, l.age].filter(Boolean).join(' · ');
    const isSelected = v.id === selectedId;
    return `
      <div class="voice-card${isSelected ? ' selected' : ''}" data-voice-id="${v.id}" onclick="selectVoiceCard('${v.id}')">
        <button type="button" class="voice-card-play" onclick="event.stopPropagation(); playVoicePreview('${v.id}', this)" title="Escuchar">▶</button>
        <div class="voice-card-info">
          <div class="voice-card-name">${escapeHtml(v.name)}</div>
          <div class="voice-card-tags">${escapeHtml(tags || v.source || '')}</div>
        </div>
        ${isSelected ? '<span class="voice-card-badge">Seleccionada</span>' : ''}
      </div>`;
  }).join('');
}

function renderVoiceOptions() {
  const sel = document.getElementById('voice-select');
  const voices = state.audio.allVoices || [];
  const gender  = document.getElementById('voice-filter-gender').value;
  const accent  = document.getElementById('voice-filter-accent').value;
  const age     = document.getElementById('voice-filter-age').value;
  const usecase = document.getElementById('voice-filter-usecase').value;

  const filtered = voices.filter(v => {
    const l = v.labels || {};
    if (gender  && l.gender  !== gender)  return false;
    if (accent  && l.accent  !== accent)  return false;
    if (age     && l.age     !== age)     return false;
    if (usecase && l.use_case !== usecase) return false;
    return true;
  });

  document.getElementById('voice-count-info').textContent =
    `${filtered.length} de ${voices.length} voces`;

  sel.innerHTML = filtered.map(v =>
    `<option value="${v.id}" data-preview="${v.preview_url || ''}">${escapeHtml(v.name)}</option>`
  ).join('');

  const list = document.getElementById('voice-list');
  list.innerHTML = filtered.length
    ? renderVoiceCards(filtered)
    : '<p class="char-info">Sin resultados con estos filtros</p>';
}

function selectVoiceCard(voiceId) {
  const sel = document.getElementById('voice-select');
  const voices = state.audio.allVoices || [];
  const voice = voices.find(v => v.id === voiceId);
  if (!voice) return;

  // Asegura que el <select> tenga una opción para esta voz (puede venir solo de búsqueda)
  if (![...sel.options].some(o => o.value === voiceId)) {
    const opt = document.createElement('option');
    opt.value = voiceId;
    opt.dataset.preview = voice.preview_url || '';
    opt.textContent = voice.name;
    sel.appendChild(opt);
  }
  sel.value = voiceId;
  document.getElementById('preview-voice-btn').disabled = false;
  document.getElementById('voice-selected-label').textContent = voice.name;

  // Refresca las tarjetas visibles para marcar la seleccionada
  document.querySelectorAll('.voice-card').forEach(card => {
    const isSel = card.dataset.voiceId === voiceId;
    card.classList.toggle('selected', isSel);
    const badge = card.querySelector('.voice-card-badge');
    if (isSel && !badge) {
      card.insertAdjacentHTML('beforeend', '<span class="voice-card-badge">Seleccionada</span>');
    } else if (!isSel && badge) {
      badge.remove();
    }
  });
}

function playVoicePreview(voiceId, btnEl) {
  const voice = (state.audio.allVoices || []).find(v => v.id === voiceId);
  if (!voice?.preview_url) { toast('Esta voz no tiene preview'); return; }

  if (currentPreviewAudio) { currentPreviewAudio.pause(); currentPreviewAudio = null; }
  document.querySelectorAll('.voice-card-play.playing').forEach(b => { b.classList.remove('playing'); b.textContent = '▶'; });

  const audio = new Audio(voice.preview_url);
  currentPreviewAudio = audio;
  if (btnEl) { btnEl.classList.add('playing'); btnEl.textContent = '⏸'; }
  audio.addEventListener('ended', () => { if (btnEl) { btnEl.classList.remove('playing'); btnEl.textContent = '▶'; } });
  audio.play().catch(() => toast('No se pudo reproducir el preview'));
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

// ============================================================
// TAB 6: GENERAR IMAGEN (ApiMart GPT-Image-2)
// ============================================================
const MAX_REF_IMAGES = 15;

function initImageRefUpload() {
  const input = document.getElementById('img-ref-input');
  const area  = document.getElementById('img-ref-area');

  function addFiles(fileList) {
    const incoming = [...fileList].filter(f => f.type.startsWith('image/'));
    for (const f of incoming) {
      if (state.image.refFiles.length >= MAX_REF_IMAGES) {
        toast(`Máximo ${MAX_REF_IMAGES} imágenes`);
        break;
      }
      state.image.refFiles.push(f);
    }
    renderImageRefGrid();
  }

  input.addEventListener('change', e => { addFiles(e.target.files); input.value = ''; });
  area.addEventListener('dragover',  e => { e.preventDefault(); area.style.borderColor = 'var(--primary)'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', e => {
    e.preventDefault(); area.style.borderColor = '';
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
}

function renderImageRefGrid() {
  const grid = document.getElementById('img-ref-grid');
  grid.innerHTML = '';
  state.image.refFiles.forEach((file, idx) => {
    const cell = document.createElement('div');
    cell.className = 'img-ref-thumb';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'img-ref-del';
    del.textContent = '×';
    del.onclick = () => { state.image.refFiles.splice(idx, 1); renderImageRefGrid(); };
    cell.appendChild(img);
    cell.appendChild(del);
    grid.appendChild(cell);
  });
  document.getElementById('img-ref-count').textContent = state.image.refFiles.length;
}

async function generateImages() {
  const prompt = document.getElementById('img-gen-prompt').value.trim();
  if (!prompt) { toast('Escribe la descripción de la imagen'); return; }

  const btn = document.getElementById('gen-image-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Generando...';
  document.getElementById('image-result').hidden = true;
  document.getElementById('image-progress').hidden = false;
  document.getElementById('image-progress-text').textContent = 'Enviando a GPT-Image-2...';

  try {
    const fd = new FormData();
    fd.append('prompt', prompt);
    fd.append('size', getChipValue('cg-img-size') || '1:1');
    fd.append('resolution', getChipValue('cg-img-res') || '2k');
    state.image.refFiles.forEach(f => fd.append('refImages', f));

    const res  = await fetch('/api/images/generate', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error generando la imagen');

    await pollImage(data.task_id);
  } catch (err) {
    toast(err.message);
    document.getElementById('image-progress').hidden = true;
  } finally {
    btn.disabled = false; btn.innerHTML = '<span>🖼️</span> Generar Imagen';
  }
}

async function pollImage(taskId) {
  const statusEl = document.getElementById('image-progress-text');
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    const res  = await fetch(`/api/images/status/${taskId}`);
    const data = await res.json();
    if (typeof data.progress === 'number') statusEl.textContent = `Generando imagen... ${data.progress}%`;
    if (data.status === 'succeeded' && data.output?.length) {
      showImageResult(data.output[0]);
      return;
    }
    if (data.status === 'failed') throw new Error(data.error || 'Falló la generación de la imagen');
  }
  throw new Error('Tiempo de espera agotado');
}

function showImageResult(imageUrl) {
  state.image.imageUrl = imageUrl;
  document.getElementById('image-progress').hidden = true;
  document.getElementById('image-output').src = imageUrl;
  const card = document.getElementById('image-result');
  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  markTabDone(6);
  setNavSub(6, 'Imagen lista ✓');
  toast('¡Imagen generada! 🎉', 'success');
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

// ============================================================
// TAB 7: CLONAR VOZ (ElevenLabs Instant Voice Cloning)
// ============================================================
const MAX_VOICE_SAMPLES = 25;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initVoiceCloneUpload() {
  const input = document.getElementById('voice-clone-input');
  const area  = document.getElementById('voice-clone-area');

  function addFiles(fileList) {
    const incoming = [...fileList].filter(f => f.type.startsWith('audio/'));
    for (const f of incoming) {
      if (state.voiceClone.sampleFiles.length >= MAX_VOICE_SAMPLES) {
        toast(`Máximo ${MAX_VOICE_SAMPLES} archivos`);
        break;
      }
      state.voiceClone.sampleFiles.push(f);
    }
    renderVoiceCloneFiles();
  }

  input.addEventListener('change', e => { addFiles(e.target.files); input.value = ''; });
  area.addEventListener('dragover',  e => { e.preventDefault(); area.style.borderColor = 'var(--primary)'; });
  area.addEventListener('dragleave', () => { area.style.borderColor = ''; });
  area.addEventListener('drop', e => {
    e.preventDefault(); area.style.borderColor = '';
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
}

function renderVoiceCloneFiles() {
  const list = document.getElementById('voice-clone-files');
  list.innerHTML = '';
  state.voiceClone.sampleFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'voice-clone-file';
    row.innerHTML = `
      <span class="voice-clone-file-name">${escapeHtml(file.name)}</span>
      <span class="voice-clone-file-size">${formatFileSize(file.size)}</span>
    `;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'voice-clone-file-del';
    del.textContent = '×';
    del.onclick = () => { state.voiceClone.sampleFiles.splice(idx, 1); renderVoiceCloneFiles(); };
    row.appendChild(del);
    list.appendChild(row);
  });
  document.getElementById('voice-clone-count').textContent = state.voiceClone.sampleFiles.length;
}

async function cloneVoice() {
  const name = document.getElementById('voice-clone-name').value.trim();
  if (!name) { toast('Escribe un nombre para la voz'); return; }
  if (!state.voiceClone.sampleFiles.length) { toast('Sube al menos una muestra de audio'); return; }

  const btn = document.getElementById('clone-voice-btn');
  btn.disabled = true; btn.innerHTML = '<span>⏳</span> Clonando voz...';
  document.getElementById('voice-clone-result').hidden = true;
  loading('Clonando voz con ElevenLabs...');

  try {
    const fd = new FormData();
    fd.append('name', name);
    const description = document.getElementById('voice-clone-description').value.trim();
    if (description) fd.append('description', description);

    const gender  = document.getElementById('voice-clone-gender').value;
    const accent  = document.getElementById('voice-clone-accent').value.trim();
    const age     = document.getElementById('voice-clone-age').value;
    const usecase = document.getElementById('voice-clone-usecase').value.trim();
    if (gender)  fd.append('gender', gender);
    if (accent)  fd.append('accent', accent);
    if (age)     fd.append('age', age);
    if (usecase) fd.append('use_case', usecase);

    state.voiceClone.sampleFiles.forEach(f => fd.append('samples', f));

    const res  = await fetch('/api/voices/clone', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error clonando la voz');

    document.getElementById('voice-clone-result-name').textContent = name;
    document.getElementById('voice-clone-result').hidden = false;
    markTabDone(7);
    setNavSub(7, 'Voz creada ✓');
    toast('¡Voz clonada correctamente! 🎉', 'success');

    // Refresca el catálogo de voces para que aparezca en el Tab de Audio
    await loadVoices();
  } catch (err) {
    toast(err.message);
  } finally {
    hideLoading();
    btn.disabled = false; btn.innerHTML = '<span>🗣️</span> Clonar Voz';
  }
}
