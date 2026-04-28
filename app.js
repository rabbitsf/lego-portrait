// LEGO palette definitions — each entry: [name, hex, [r,g,b]]
const PALETTES = [
  {
    id: 'classic',
    label: 'Classic',
    colors: [
      { name: 'Black',      hex: '#1B1B1B', rgb: [27,  27,  27]  },
      { name: 'Dark Grey',  hex: '#6B6B6B', rgb: [107, 107, 107] },
      { name: 'Light Grey', hex: '#A0A0A0', rgb: [160, 160, 160] },
      { name: 'White',      hex: '#F4F4F4', rgb: [244, 244, 244] },
      { name: 'Yellow',     hex: '#F5C518', rgb: [245, 197, 24]  },
    ],
  },
  {
    id: 'warm',
    label: 'Warm',
    colors: [
      { name: 'Black',      hex: '#1B1B1B', rgb: [27,  27,  27]  },
      { name: 'Dark Brown', hex: '#5C3A1E', rgb: [92,  58,  30]  },
      { name: 'Tan',        hex: '#C9A96E', rgb: [201, 169, 110] },
      { name: 'Cream',      hex: '#F5EDD6', rgb: [245, 237, 214] },
      { name: 'Yellow',     hex: '#F5C518', rgb: [245, 197, 24]  },
    ],
  },
  {
    id: 'cool',
    label: 'Cool',
    colors: [
      { name: 'Black',      hex: '#1B1B1B', rgb: [27,  27,  27]  },
      { name: 'Dark Blue',  hex: '#1C4587', rgb: [28,  69,  135] },
      { name: 'Blue',       hex: '#4A90D9', rgb: [74,  144, 217] },
      { name: 'Light Blue', hex: '#A8C8E8', rgb: [168, 200, 232] },
      { name: 'White',      hex: '#F4F4F4', rgb: [244, 244, 244] },
    ],
  },
  {
    id: 'retro',
    label: 'Retro',
    colors: [
      { name: 'Black',   hex: '#1B1B1B', rgb: [27,  27,  27]  },
      { name: 'Red',     hex: '#C1121F', rgb: [193, 18,  31]  },
      { name: 'Orange',  hex: '#F77F00', rgb: [247, 127, 0]   },
      { name: 'Yellow',  hex: '#F5C518', rgb: [245, 197, 24]  },
      { name: 'White',   hex: '#F4F4F4', rgb: [244, 244, 244] },
    ],
  },
];

const CANVAS_PX = 500;
let GRID_SIZE   = 50;
let STUD_PX     = CANVAS_PX / GRID_SIZE;

let currentImage   = null;
let currentPalette = PALETTES[0];
let contrastValue  = 100;
let zoomValue      = 100;
let quantizedGrid  = null; // [50*50] index into currentPalette.colors

// ── DOM refs ──────────────────────────────────────────────────────────────────
const fileInput     = document.getElementById('file-input');
const uploadTrigger = document.getElementById('upload-trigger');
const placeholder   = document.getElementById('placeholder');
const mosaicCanvas  = document.getElementById('mosaic-canvas');
const workCanvas    = document.getElementById('work-canvas');
const zoomSlider    = document.getElementById('zoom-slider');
const contrastSlider= document.getElementById('contrast-slider');
const pieceCountsEl = document.getElementById('piece-counts');
const paletteOptEl  = document.getElementById('palette-options');
const resetBtn      = document.getElementById('reset-btn');
const restartBtn    = document.getElementById('restart-btn');

// ── Init ──────────────────────────────────────────────────────────────────────
buildPaletteUI();

uploadTrigger.addEventListener('click', () => fileInput.click());
document.getElementById('placeholder').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});

zoomSlider.addEventListener('input', () => {
  zoomValue = parseInt(zoomSlider.value);
  if (currentImage) processAndRender();
});

document.getElementById('zoom-minus').addEventListener('click', () => {
  zoomSlider.value = Math.max(parseInt(zoomSlider.min), parseInt(zoomSlider.value) - 10);
  zoomValue = parseInt(zoomSlider.value);
  if (currentImage) processAndRender();
});

document.getElementById('zoom-plus').addEventListener('click', () => {
  zoomSlider.value = Math.min(parseInt(zoomSlider.max), parseInt(zoomSlider.value) + 10);
  zoomValue = parseInt(zoomSlider.value);
  if (currentImage) processAndRender();
});

contrastSlider.addEventListener('input', () => {
  contrastValue = parseInt(contrastSlider.value);
  if (currentImage) processAndRender();
});

document.getElementById('contrast-minus').addEventListener('click', () => {
  contrastSlider.value = Math.max(parseInt(contrastSlider.min), parseInt(contrastSlider.value) - 10);
  contrastValue = parseInt(contrastSlider.value);
  if (currentImage) processAndRender();
});

document.getElementById('contrast-plus').addEventListener('click', () => {
  contrastSlider.value = Math.min(parseInt(contrastSlider.max), parseInt(contrastSlider.value) + 10);
  contrastValue = parseInt(contrastSlider.value);
  if (currentImage) processAndRender();
});

resetBtn.addEventListener('click', () => {
  zoomSlider.value    = 100;
  contrastSlider.value= 100;
  zoomValue    = 100;
  contrastValue= 100;
  if (currentImage) processAndRender();
});

document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    GRID_SIZE = parseInt(btn.dataset.size);
    STUD_PX   = CANVAS_PX / GRID_SIZE;
    updateSubtitle();
    if (currentImage) processAndRender();
  });
});

function updateSubtitle() {
  document.getElementById('subtitle').textContent =
    `Bring your photos to life with bricks — ${GRID_SIZE}×${GRID_SIZE} stud baseplate`;
}

restartBtn.addEventListener('click', () => {
  currentImage  = null;
  quantizedGrid = null;
  placeholder.classList.remove('hidden');
  mosaicCanvas.classList.add('hidden');
  pieceCountsEl.innerHTML = '<p style="font-size:12px;color:#aaa;">Upload a photo to see piece counts.</p>';
  fileInput.value = '';
});

// ── Palette UI ────────────────────────────────────────────────────────────────
function buildPaletteUI() {
  paletteOptEl.innerHTML = '';
  PALETTES.forEach((palette, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'palette-option' + (i === 0 ? ' active' : '');
    wrap.title = palette.label;

    const row = document.createElement('div');
    row.className = 'swatch-row';
    palette.colors.forEach(c => {
      const s = document.createElement('span');
      s.style.background = c.hex;
      row.appendChild(s);
    });

    wrap.appendChild(row);
    wrap.addEventListener('click', () => selectPalette(palette, wrap));
    paletteOptEl.appendChild(wrap);
  });
}

function selectPalette(palette, el) {
  currentPalette = palette;
  document.querySelectorAll('.palette-option').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  if (currentImage) processAndRender();
}

// ── Image loading ─────────────────────────────────────────────────────────────
function loadImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      currentImage = img;
      processAndRender();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Core pipeline ─────────────────────────────────────────────────────────────
function processAndRender() {
  quantizedGrid = quantizeImage(currentImage, contrastValue);
  renderMosaic(quantizedGrid);
  updatePieceCounts(quantizedGrid);

  placeholder.classList.add('hidden');
  mosaicCanvas.classList.remove('hidden');
}

// Sample image to 50×50, apply contrast, then nearest-color quantize
function quantizeImage(img, contrast) {
  const wc  = workCanvas;
  const ctx = wc.getContext('2d');
  wc.width  = GRID_SIZE;
  wc.height = GRID_SIZE;

  const aspect = img.width / img.height;
  const zoomFactor = zoomValue / 100;

  // The zoom level at which the letterbox disappears and image fills the grid exactly.
  // Below this: gradually shrink letterbox. Above this: zoom in on the square crop.
  const fillThreshold = aspect < 1 ? (1 / aspect) : (aspect > 1 ? aspect : 1);

  let srcX, srcY, srcW, srcH, dstX = 0, dstY = 0, dstW = GRID_SIZE, dstH = GRID_SIZE;

  if (zoomFactor < fillThreshold) {
    // Letterbox mode: show full image, gradually crop the longer axis toward a square
    if (aspect < 1) {
      // Portrait — full width, height shrinks toward img.width as zoom rises
      srcW = img.width;
      srcH = img.height / zoomFactor;
      srcX = 0;
      srcY = (img.height - srcH) / 2;
    } else {
      // Landscape — full height, width shrinks toward img.height as zoom rises
      srcH = img.height;
      srcW = img.width / zoomFactor;
      srcX = (img.width - srcW) / 2;
      srcY = 0;
    }
    const ra = srcW / srcH;
    if (ra < 1) {
      dstW = GRID_SIZE * ra; dstH = GRID_SIZE;
      dstX = (GRID_SIZE - dstW) / 2;
    } else {
      dstH = GRID_SIZE / ra; dstW = GRID_SIZE;
      dstY = (GRID_SIZE - dstH) / 2;
    }
    ctx.filter = 'none';
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
  } else {
    // Zoom-in mode: square center crop, gets tighter as zoom increases
    const squareSize = Math.max(img.width, img.height) / zoomFactor;
    srcW = squareSize; srcH = squareSize;
    srcX = (img.width  - squareSize) / 2;
    srcY = (img.height - squareSize) / 2;
  }

  ctx.filter = `contrast(${contrast}%)`;
  ctx.drawImage(img, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

  const { data } = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const grid = new Array(GRID_SIZE * GRID_SIZE);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grid[i] = nearestColor(r, g, b, currentPalette.colors);
  }

  return grid;
}

// Euclidean distance in RGB space
function nearestColor(r, g, b, colors) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < colors.length; i++) {
    const [cr, cg, cb] = colors[i].rgb;
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// ── Mosaic renderer ───────────────────────────────────────────────────────────
function renderMosaic(grid) {
  const ctx = mosaicCanvas.getContext('2d');
  const colors = currentPalette.colors;
  const size = GRID_SIZE * STUD_PX;
  mosaicCanvas.width  = size;
  mosaicCanvas.height = size;

  ctx.clearRect(0, 0, size, size);

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const colorIdx = grid[row * GRID_SIZE + col];
      const color    = colors[colorIdx];
      const x = col * STUD_PX;
      const y = row * STUD_PX;

      // Base tile
      ctx.fillStyle = color.hex;
      ctx.fillRect(x, y, STUD_PX, STUD_PX);

      // Stud circle (lighter highlight)
      ctx.beginPath();
      ctx.arc(x + STUD_PX / 2, y + STUD_PX / 2, STUD_PX * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = lighten(color.hex, 22);
      ctx.fill();
    }
  }

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth   = 0.5;
  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * STUD_PX, 0); ctx.lineTo(i * STUD_PX, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * STUD_PX); ctx.lineTo(size, i * STUD_PX); ctx.stroke();
  }
}

// Lighten a hex color by adding `amount` to each channel
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

// ── Piece counts ──────────────────────────────────────────────────────────────
function updatePieceCounts(grid) {
  const colors  = currentPalette.colors;
  const counts  = new Array(colors.length).fill(0);
  grid.forEach(i => counts[i]++);

  const total = counts.reduce((a, b) => a + b, 0);

  let html = '';
  colors.forEach((color, i) => {
    html += `
      <div class="piece-row">
        <div class="piece-swatch" style="background:${color.hex}"></div>
        <div class="piece-info">
          <div class="piece-name">${color.name}</div>
          <div class="piece-count">${counts[i]}</div>
        </div>
      </div>`;
  });

  html += `
    <div class="piece-total">
      Total studs: <strong>${total}</strong>
    </div>`;

  pieceCountsEl.innerHTML = html;
}

