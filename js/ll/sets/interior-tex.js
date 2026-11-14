// Procedural textures for the Last Light interior: closeout panels, fabric,
// deck plates (each with a normal and a roughness map baked from a height
// canvas), a label atlas (placards, legends, stencils: all readable text) and
// the live screens atlas (the three cockpit displays, the caution & warning
// panel, laptops, small readouts).
import { THREE, rng, clamp } from './common.js';

export const FONT = 'Archivo, "Arial Narrow", Arial, sans-serif';
export const MONO = '"DejaVu Sans Mono", Consolas, "Roboto Mono", monospace';

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = o.clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = o.aniso || 8;
  if (o.noMip) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}

export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Tangent-space normal map from a grey height canvas (wraps at the edges).
export function normalFromHeight(hc, strength = 2.5) {
  const w = hc.width;
  const h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = mkCanvas(w, h);
  const og = out.getContext('2d');
  const img = og.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx;
      let ny = dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

// Soft value noise blotches (grime, wear), drawn as many faint ellipses.
function blotches(g, w, h, r, n, color, aMax, sMin, sMax) {
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = sMin + r() * (sMax - sMin);
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    const a = r() * aMax;
    gr.addColorStop(0, color.replace('A', a.toFixed(3)));
    gr.addColorStop(1, color.replace('A', '0'));
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
}
function speckle(g, w, h, r, n, color, size = 1) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) g.fillRect(r() * w, r() * h, size, size);
}
function scuffs(g, w, h, r, n, color, len = 30) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = len * (0.3 + r());
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
}

// ---------- Closeout panels (1 tile = 1 m) ----------
// Colour (light, tinted by vertex colours), height and roughness drawn in step.
export function panelMaps(size = 1024, seed = 3) {
  const S = size / 1024;
  const col = mkCanvas(size, size);
  const hei = mkCanvas(size, size);
  const rou = mkCanvas(size, size);
  const c = col.getContext('2d');
  const hg = hei.getContext('2d');
  const ro = rou.getContext('2d');
  const r = rng(seed);
  c.fillStyle = '#d6d8d4';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = '#6a6a6a';
  hg.fillRect(0, 0, size, size);
  ro.fillStyle = '#9a9a9a';
  ro.fillRect(0, 0, size, size);
  // Panel layout: a 2 x 2 grid, two of the cells split again.
  const cells = [];
  const half = size / 2;
  cells.push([0, 0, half, half]);
  cells.push([half, 0, half, half * 0.5], [half, half * 0.5, half, half * 0.5]);
  cells.push([0, half, half * 0.62, half], [half * 0.62, half, half * 0.38, half]);
  cells.push([half, half, half, half]);
  const g0 = 6 * S;
  cells.forEach(([x, y, w, h], i) => {
    const v = 196 + Math.floor(r() * 30) - (i === 4 ? 30 : 0);
    const gr = c.createLinearGradient(x, y, x + w * 0.4, y + h);
    gr.addColorStop(0, `rgb(${v + 4},${v + 6},${v + 4})`);
    gr.addColorStop(1, `rgb(${v - 10},${v - 9},${v - 11})`);
    c.fillStyle = gr;
    rr(c, x + g0, y + g0, w - 2 * g0, h - 2 * g0, 10 * S);
    c.fill();
    // Height: raised panel with a bevel.
    hg.fillStyle = '#9a9a9a';
    rr(hg, x + g0, y + g0, w - 2 * g0, h - 2 * g0, 10 * S);
    hg.fill();
    hg.fillStyle = '#b4b4b4';
    rr(hg, x + g0 + 7 * S, y + g0 + 7 * S, w - 2 * g0 - 14 * S, h - 2 * g0 - 14 * S, 8 * S);
    hg.fill();
    ro.fillStyle = `rgb(${120 + Math.floor(r() * 30)},0,0)`.replace(',0,0', ',' + (120 + Math.floor(r() * 30)) + ',' + 128);
    ro.fillStyle = '#8c8c8c';
    rr(ro, x + g0, y + g0, w - 2 * g0, h - 2 * g0, 10 * S);
    ro.fill();
    // Fasteners along the edges.
    const step = 86 * S;
    const pts = [];
    for (let fx = x + 22 * S; fx < x + w - 15 * S; fx += step) pts.push([fx, y + 20 * S], [fx, y + h - 20 * S]);
    for (let fy = y + 22 * S + step; fy < y + h - 15 * S - step * 0.5; fy += step) pts.push([x + 20 * S, fy], [x + w - 20 * S, fy]);
    pts.forEach(([fx, fy]) => {
      const rad = 5.2 * S;
      const fg = c.createRadialGradient(fx - rad * 0.3, fy - rad * 0.3, 0, fx, fy, rad);
      fg.addColorStop(0, '#f2f3f2');
      fg.addColorStop(1, '#7d858a');
      c.fillStyle = fg;
      c.beginPath();
      c.arc(fx, fy, rad, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(40,46,50,0.75)';
      c.lineWidth = 1.2 * S;
      c.beginPath();
      c.moveTo(fx - rad * 0.6, fy);
      c.lineTo(fx + rad * 0.6, fy);
      c.moveTo(fx, fy - rad * 0.6);
      c.lineTo(fx, fy + rad * 0.6);
      c.stroke();
      hg.fillStyle = '#e0e0e0';
      hg.beginPath();
      hg.arc(fx, fy, rad, 0, Math.PI * 2);
      hg.fill();
      hg.fillStyle = '#909090';
      hg.fillRect(fx - rad * 0.6, fy - 0.8 * S, rad * 1.2, 1.6 * S);
      ro.fillStyle = '#505050';
      ro.beginPath();
      ro.arc(fx, fy, rad, 0, Math.PI * 2);
      ro.fill();
    });
    // A small part-number stencil in a corner of some panels.
    if (r() < 0.75) {
      c.fillStyle = 'rgba(55,62,70,0.7)';
      c.font = `600 ${Math.round(13 * S)}px ${FONT}`;
      const id = ['LSP', 'CP', 'PNL', 'MDF', 'ECL', 'AV'][Math.floor(r() * 6)] + '-' + (10 + Math.floor(r() * 89)) + String.fromCharCode(65 + Math.floor(r() * 6));
      c.fillText(id, x + 34 * S, y + h - 34 * S);
    }
  });
  // Recessed seams between panels.
  c.strokeStyle = 'rgba(48,54,60,0.85)';
  hg.strokeStyle = '#202020';
  c.lineWidth = hg.lineWidth = 3 * S;
  cells.forEach(([x, y, w, h]) => {
    rr(c, x + g0 * 0.5, y + g0 * 0.5, w - g0, h - g0, 10 * S);
    c.stroke();
    rr(hg, x + g0 * 0.5, y + g0 * 0.5, w - g0, h - g0, 10 * S);
    hg.stroke();
  });
  // Grime, scuffs, finger marks (more toward the bottom of the tile).
  blotches(c, size, size, r, 90, 'rgba(80,76,66,A)', 0.14, 20 * S, 140 * S);
  // Grime collects along the seams and the lower edges.
  cells.forEach(([x, y, w, h]) => {
    const gr = c.createLinearGradient(0, y + h * 0.55, 0, y + h);
    gr.addColorStop(0, 'rgba(60,56,48,0)');
    gr.addColorStop(1, 'rgba(60,56,48,0.16)');
    c.fillStyle = gr;
    c.fillRect(x, y, w, h);
  });
  blotches(c, size, size, r, 30, 'rgba(255,255,255,A)', 0.08, 20 * S, 90 * S);
  scuffs(c, size, size, r, 110, 'rgba(70,72,74,0.22)', 34 * S);
  scuffs(c, size, size, r, 20, 'rgba(30,30,30,0.28)', 14 * S);
  speckle(c, size, size, r, 1400 * S * S, 'rgba(60,60,60,0.10)', 1.5 * S);
  scuffs(ro, size, size, rng(seed + 9), 70, 'rgba(200,200,200,0.35)', 34 * S);
  blotches(ro, size, size, rng(seed + 4), 40, 'rgba(70,70,70,A)', 0.4, 20 * S, 90 * S);
  // Micro surface noise for the normal map.
  speckle(hg, size, size, r, 9000 * S * S, 'rgba(130,130,130,0.25)', 1);
  return {
    map: tex(col),
    normalMap: tex(normalFromHeight(hei, 3.2), { srgb: false }),
    roughnessMap: tex(rou, { srgb: false }),
  };
}

// ---------- Fabric: quilted Nomex soft goods (1 tile = 0.5 m) ----------
export function fabricMaps(size = 512, seed = 7) {
  const S = size / 512;
  const col = mkCanvas(size, size);
  const hei = mkCanvas(size, size);
  const c = col.getContext('2d');
  const hg = hei.getContext('2d');
  const r = rng(seed);
  c.fillStyle = '#e9e6dc';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = '#808080';
  hg.fillRect(0, 0, size, size);
  // Weave.
  for (let y = 0; y < size; y += 2) {
    c.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.03})`;
    c.fillRect(0, y, size, 1);
    hg.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.06})`;
    hg.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 2) {
    c.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`;
    c.fillRect(x, 0, 1, size);
    hg.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`;
    hg.fillRect(x, 0, 1, size);
  }
  // Quilting: puffed diamonds between stitch lines.
  const q = 128 * S;
  for (let y = -q; y < size + q; y += q) {
    for (let x = -q; x < size + q; x += q) {
      const gr = hg.createRadialGradient(x + q / 2, y + q / 2, 0, x + q / 2, y + q / 2, q * 0.62);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0.0)');
      hg.fillStyle = gr;
      hg.fillRect(x, y, q, q);
    }
  }
  c.strokeStyle = 'rgba(80,76,66,0.45)';
  hg.strokeStyle = 'rgba(0,0,0,0.9)';
  c.lineWidth = 1.4 * S;
  hg.lineWidth = 2.4 * S;
  c.setLineDash([5 * S, 3 * S]);
  for (let k = 0; k <= size; k += q) {
    [c, hg].forEach((g) => {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k, size);
      g.moveTo(0, k);
      g.lineTo(size, k);
      g.stroke();
    });
  }
  c.setLineDash([]);
  blotches(c, size, size, r, 30, 'rgba(110,100,80,A)', 0.1, 20 * S, 90 * S);
  speckle(c, size, size, r, 600 * S, 'rgba(90,80,60,0.15)', 1.5 * S);
  return { map: tex(col), normalMap: tex(normalFromHeight(hei, 2.2), { srgb: false }) };
}

// ---------- Deck plates (1 tile = 1 m) ----------
export function deckMaps(size = 1024, seed = 11) {
  const S = size / 1024;
  const col = mkCanvas(size, size);
  const hei = mkCanvas(size, size);
  const c = col.getContext('2d');
  const hg = hei.getContext('2d');
  const r = rng(seed);
  c.fillStyle = '#7d858a';
  c.fillRect(0, 0, size, size);
  hg.fillStyle = '#909090';
  hg.fillRect(0, 0, size, size);
  // Anti-slip diamond tread on the plates.
  c.fillStyle = 'rgba(30,34,38,0.22)';
  hg.fillStyle = '#c0c0c0';
  for (let y = 0; y < size; y += 16 * S) {
    for (let x = (y / (16 * S)) % 2 ? 8 * S : 0; x < size; x += 16 * S) {
      c.fillRect(x, y, 7 * S, 2.5 * S);
      hg.fillRect(x, y, 7 * S, 2.5 * S);
    }
  }
  // Plate seams and a seat-track rail with holes down the middle.
  const seam = (x, y, w, h) => {
    c.strokeStyle = 'rgba(20,22,26,0.9)';
    c.lineWidth = 4 * S;
    c.strokeRect(x, y, w, h);
    hg.strokeStyle = '#202020';
    hg.lineWidth = 4 * S;
    hg.strokeRect(x, y, w, h);
  };
  seam(4 * S, 4 * S, size / 2 - 8 * S, size - 8 * S);
  seam(size / 2 + 4 * S, 4 * S, size / 2 - 8 * S, size - 8 * S);
  c.fillStyle = '#a7aeb2';
  c.fillRect(size / 2 - 22 * S, 0, 44 * S, size);
  hg.fillStyle = '#e0e0e0';
  hg.fillRect(size / 2 - 22 * S, 0, 44 * S, size);
  for (let y = 12 * S; y < size; y += 25.6 * S) {
    c.fillStyle = '#1b1f22';
    c.beginPath();
    c.arc(size / 2, y, 7 * S, 0, Math.PI * 2);
    c.fill();
    hg.fillStyle = '#303030';
    hg.beginPath();
    hg.arc(size / 2, y, 7 * S, 0, Math.PI * 2);
    hg.fill();
  }
  // Two floor stowage hatches with recessed pull handles.
  [
    [90, 140, 300, 330],
    [634, 520, 300, 330],
  ].forEach(([x, y, w, h]) => {
    x *= S;
    y *= S;
    w *= S;
    h *= S;
    seam(x, y, w, h);
    c.fillStyle = '#23282c';
    rr(c, x + w / 2 - 34 * S, y + h / 2 - 9 * S, 68 * S, 18 * S, 9 * S);
    c.fill();
    hg.fillStyle = '#404040';
    rr(hg, x + w / 2 - 34 * S, y + h / 2 - 9 * S, 68 * S, 18 * S, 9 * S);
    hg.fill();
    c.fillStyle = 'rgba(240,240,240,0.75)';
    c.font = `700 ${Math.round(22 * S)}px ${FONT}`;
    c.fillText(['D1', 'D4'][x > size / 2 ? 1 : 0], x + 18 * S, y + 32 * S);
  });
  // Yellow keep-out stripe at one end.
  c.save();
  c.beginPath();
  c.rect(0, size - 60 * S, size / 2 - 30 * S, 46 * S);
  c.clip();
  for (let x = -60; x < size; x += 40) {
    c.fillStyle = '#d9a21b';
    c.beginPath();
    c.moveTo(x * S, size - 14 * S);
    c.lineTo((x + 20) * S, size - 14 * S);
    c.lineTo((x + 66) * S, size - 60 * S);
    c.lineTo((x + 46) * S, size - 60 * S);
    c.fill();
  }
  c.restore();
  blotches(c, size, size, r, 50, 'rgba(20,20,20,A)', 0.18, 30 * S, 140 * S);
  scuffs(c, size, size, r, 120, 'rgba(200,205,210,0.18)', 40 * S);
  speckle(c, size, size, r, 3000 * S * S, 'rgba(255,255,255,0.08)', 1.5 * S);
  return { map: tex(col), normalMap: tex(normalFromHeight(hei, 2.6), { srgb: false }) };
}

// Brushed/anodised metal variation for the roughness channel.
export function metalRough(size = 256, seed = 5) {
  const c = mkCanvas(size, size);
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = '#7a7a7a';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 2; i++) {
    g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.08})`;
    g.fillRect(0, r() * size, size, 1);
  }
  blotches(g, size, size, r, 25, 'rgba(255,255,255,A)', 0.25, 10, 60);
  scuffs(g, size, size, r, 40, 'rgba(30,30,30,0.4)', 20);
  return tex(c, { srgb: false });
}

// ---------- Label atlas ----------
// atlas.add(wPx, hPx, draw(g, w, h)) -> { u0, v0, u1, v1, w, h }; draws are
// kept so redraw() can repeat them once the web font has loaded.
export function createAtlas(size = 2048) {
  const c = mkCanvas(size, size);
  const g = c.getContext('2d');
  const t = tex(c, { clampEdge: true });
  t.anisotropy = 8;
  const items = [];
  // Shelf packing: an item goes on the first shelf tall enough (and not much
  // taller) with room left, else on a new shelf.
  const shelves = [];
  let nextY = 0;
  const pad = 4;
  let area = 0;
  // scale < 1 stores the drawing smaller (draw still sees the logical size).
  function add(lw, lh, draw, scale = 1) {
    const w = Math.ceil(lw * scale);
    const h = Math.ceil(lh * scale);
    let s = null;
    for (const q of shelves) if (h <= q.h && q.x + w + pad <= size && (!s || q.h < s.h)) s = q;
    if (s && s.h > h * 2.2 && nextY + h <= size) s = null;
    if (!s) {
      if (nextY + h > size) {
        console.warn('interior atlas full', w, h, Math.round((area / size / size) * 100) + '%');
        return { u0: 0, v0: 0, u1: 0.001, v1: 0.001, w, h };
      }
      s = { y: nextY, h, x: 0 };
      shelves.push(s);
      nextY += h + pad;
    }
    const it = { x: s.x, y: s.y, w, h, draw, scale, lw: Math.ceil(lw), lh: Math.ceil(lh) };
    s.x += w + pad;
    area += w * h;
    items.push(it);
    paint(it);
    // Inset by half a texel so filtering never bleeds a neighbour in.
    return { u0: (it.x + 0.5) / size, v0: 1 - (it.y + h - 0.5) / size, u1: (it.x + w - 0.5) / size, v1: 1 - (it.y + 0.5) / size, w, h };
  }
  function paint(it) {
    g.save();
    g.beginPath();
    g.rect(it.x, it.y, it.w, it.h);
    g.clip();
    g.clearRect(it.x, it.y, it.w, it.h);
    g.translate(it.x, it.y);
    if (it.scale !== 1) g.scale(it.w / it.lw, it.h / it.lh);
    it.draw(g, it.lw, it.lh);
    g.restore();
  }
  return {
    canvas: c,
    texture: t,
    add,
    redraw() {
      g.clearRect(0, 0, size, size);
      items.forEach(paint);
      t.needsUpdate = true;
    },
    used: () => ({ height: nextY, area: area / size / size }),
  };
}

// A placard: rounded plate, border, centred text lines.
// o: { bg, fg, border, lines: [[text, sizePx, weight]], radius, align }
export function drawPlacard(g, w, h, o) {
  g.fillStyle = o.bg || '#f2f1ea';
  rr(g, 1, 1, w - 2, h - 2, o.radius == null ? Math.min(w, h) * 0.12 : o.radius);
  g.fill();
  if (o.border) {
    g.strokeStyle = o.border;
    g.lineWidth = o.borderW || Math.max(2, h * 0.05);
    rr(g, g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2, (o.radius == null ? Math.min(w, h) * 0.12 : o.radius) * 0.7);
    g.stroke();
  }
  const lines = o.lines || [];
  const total = lines.reduce((s, l) => s + l[1] * 1.12, 0);
  let yy = h / 2 - total / 2;
  g.fillStyle = o.fg || '#1b1f24';
  g.textBaseline = 'top';
  lines.forEach(([text, sz, wt, color]) => {
    g.font = `${wt || 700} ${sz}px ${FONT}`;
    g.fillStyle = color || o.fg || '#1b1f24';
    let s = sz;
    while (g.measureText(text).width > w - 12 && s > 8) {
      s -= 1;
      g.font = `${wt || 700} ${s}px ${FONT}`;
    }
    g.textAlign = o.align || 'center';
    g.fillText(text, o.align === 'left' ? 10 : w / 2, yy + (sz - s) / 2);
    yy += sz * 1.12;
  });
}

// Stencil text, no plate (alpha-tested).
export function drawStencil(g, w, h, text, o = {}) {
  g.fillStyle = o.color || 'rgba(40,46,52,0.9)';
  g.font = `${o.weight || 800} ${o.size || Math.round(h * 0.7)}px ${FONT}`;
  g.textAlign = o.align || 'center';
  g.textBaseline = 'middle';
  g.fillText(text, o.align === 'left' ? 4 : w / 2, h / 2 + 2);
}

// Barcode stripes (stowage labels).
export function drawBarcode(g, x, y, w, h, seed) {
  const r = rng(seed);
  let xx = x;
  g.fillStyle = '#111';
  while (xx < x + w - 2) {
    const bw = 1 + Math.floor(r() * 3);
    if (r() < 0.55) g.fillRect(xx, y, bw, h);
    xx += bw + 1;
  }
}

// A soft, slightly smudged frost/glass mask for the windows.
export function frostTexture(size = 256, seed = 11) {
  const c = mkCanvas(size, size);
  const g = c.getContext('2d');
  const r = rng(seed);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size) * 2 - 1;
      const dy = (y / size) * 2 - 1;
      const edge = clamp(Math.hypot(dx, dy) * 1.05);
      const v = clamp(edge * edge * 1.1 + (r() - 0.5) * 0.3);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Smudges (green channel): finger marks and a wiped arc.
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 14; k++) {
    const x = r() * size;
    const y = r() * size;
    const s = 8 + r() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, 'rgba(0,60,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  g.globalCompositeOperation = 'source-over';
  const t = tex(c, { srgb: false, clampEdge: true });
  return t;
}

// Environment map: an equirect sketch of the lit cabin (bright LED bands,
// dark deck, a cool window) so metal and glossy plastic reflect something.
export function cabinEnv() {
  const w = 512;
  const h = 256;
  const c = mkCanvas(w, h);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#9aa3ab');
  gr.addColorStop(0.45, '#6d757c');
  gr.addColorStop(0.6, '#3a4046');
  gr.addColorStop(1, '#16191c');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffffff';
  [0.1, 0.35, 0.6, 0.85].forEach((u) => g.fillRect(u * w, h * 0.18, w * 0.09, 5));
  g.fillStyle = '#eaf3ff';
  g.fillRect(0, h * 0.3, w, 3);
  const win = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, 40);
  win.addColorStop(0, 'rgba(210,225,255,1)');
  win.addColorStop(1, 'rgba(210,225,255,0)');
  g.fillStyle = win;
  g.fillRect(0, 0, w, h);
  const warm = g.createRadialGradient(w * 0.78, h * 0.55, 0, w * 0.78, h * 0.55, 50);
  warm.addColorStop(0, 'rgba(255,190,120,0.9)');
  warm.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
