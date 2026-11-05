import * as THREE from './three.js';

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = []; let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Draws wrapped text on a canvas and returns {canvas, texture}.
export function textTexture({ width = 1024, height = 512, bg = null, draw }) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const redraw = (...args) => {
    ctx.clearRect(0, 0, width, height);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); }
    draw(ctx, { width, height, wrap: (t, w) => wrap(ctx, t, w) }, ...args);
    texture.needsUpdate = true;
  };
  redraw();
  return { canvas, texture, redraw };
}

export function stainedGlassTexture(seed, palette) {
  const W = 256, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  // arch clip
  ctx.beginPath();
  ctx.moveTo(0, H); ctx.lineTo(0, W / 2); ctx.arc(W / 2, W / 2, W / 2, Math.PI, 0); ctx.lineTo(W, H); ctx.closePath();
  ctx.clip();
  const cell = 32;
  for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.fillRect(x, y, cell, cell);
  }
  // central motif: a cross of light
  ctx.fillStyle = 'rgba(255,240,190,0.95)';
  ctx.fillRect(W / 2 - 14, 70, 28, 300);
  ctx.fillRect(W / 2 - 70, 150, 140, 28);
  // lead lines
  ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 4;
  for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, W / 2); ctx.arc(W / 2, W / 2, W / 2, Math.PI, 0); ctx.lineTo(W, H); ctx.closePath(); ctx.stroke();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function roseWindowTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const c = S / 2;
  const colors = ['#2a4dbd', '#c0282d', '#e8b83a', '#2f8f5b', '#7b3fb0', '#1f8fbf'];
  ctx.beginPath(); ctx.arc(c, c, c - 6, 0, Math.PI * 2); ctx.clip();
  for (let ring = 4; ring >= 1; ring--) {
    const r = (c - 6) * ring / 4, petals = 6 * ring;
    for (let i = 0; i < petals; i++) {
      ctx.beginPath(); ctx.moveTo(c, c);
      ctx.arc(c, c, r, (i / petals) * Math.PI * 2, ((i + 1) / petals) * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = colors[(i + ring) % colors.length];
      ctx.fill(); ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 5; ctx.stroke();
    }
  }
  ctx.beginPath(); ctx.arc(c, c, 46, 0, Math.PI * 2); ctx.fillStyle = '#ffe7a0'; ctx.fill();
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function floorTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const n = 8, cell = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#d9cdb8' : '#b8a68a';
    ctx.fillRect(x * cell, y * cell, cell, cell);
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 10);
  t.anisotropy = 8;
  return t;
}

export function glowSprite() {
  const S = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,245,200,1)');
  g.addColorStop(0.4, 'rgba(255,220,120,0.5)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}
