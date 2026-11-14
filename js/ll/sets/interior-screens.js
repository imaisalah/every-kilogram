// The live screens of the Last Light interior, all in one canvas atlas (one
// texture upload, one draw call per zone): the three glass-cockpit displays
// (TRAJ, EPS, ECLSS), the caution & warning panel, two laptops, the breaker
// panels' amp readouts and the habitat status panel. Pages are redrawn only
// when what they show changes (the MET clock ticks once a second).
import { THREE, clamp, rng } from './common.js';
import { FONT, MONO, rr } from './interior-tex.js';

const C = {
  bg: '#03070b',
  line: '#1b3644',
  dim: '#5d7684',
  text: '#e4eef3',
  cyan: '#62d2ff',
  green: '#45e38a',
  amber: '#ffb52e',
  red: '#ff4636',
  magenta: '#e46cff',
};

// Breakers: label and the current each one draws (amps) when closed.
export const BREAKERS = [
  { n: 1, label: 'CABIN HTR', amps: 9.2 },
  { n: 2, label: 'DISPLAYS 2-3', amps: 6.4 },
  { n: 3, label: 'FAN 2', amps: 3.1 },
  { n: 4, label: 'GUID CMPTR', amps: 11.8 },
  { n: 5, label: 'HAB LIGHTS', amps: 4.6 },
  { n: 6, label: 'HAB HTR', amps: 12.5 },
  { n: 7, label: 'CRYO FANS', amps: 5.3 },
  { n: 8, label: 'PROBE HTR', amps: 7.9 },
];

const W = 2048;
const H = 1024;
const R = {
  d0: [0, 0, 672, 432],
  d1: [688, 0, 672, 432],
  d2: [1376, 0, 672, 432],
  cw: [0, 448, 512, 192],
  lapA: [528, 448, 512, 320],
  lapB: [1056, 448, 512, 320],
  brk1: [1584, 448, 448, 112],
  brk2: [1584, 576, 448, 112],
  hab: [1584, 704, 448, 288],
};

function font(g, wt, px, mono) {
  g.font = `${wt} ${px}px ${mono ? MONO : FONT}`;
}
function txt(g, s, x, y, color, wt = 600, px = 22, align = 'left', mono = false) {
  font(g, wt, px, mono);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillText(s, x, y);
}
function pad2(n) {
  return String(Math.floor(n)).padStart(2, '0');
}
function met(s) {
  return `${String(Math.floor(s / 3600)).padStart(3, '0')}:${pad2((s / 60) % 60)}:${pad2(s % 60)}`;
}
// Screen base: deep black-blue glass, a header bar, faint scan lines.
function base(g, w, h, title, sub, state) {
  g.fillStyle = C.bg;
  g.fillRect(0, 0, w, h);
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(20,40,55,0.35)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#0b1820';
  g.fillRect(0, 0, w, 44);
  g.fillStyle = C.line;
  g.fillRect(0, 44, w, 2);
  g.fillStyle = C.cyan;
  g.fillRect(12, 10, 6, 24);
  txt(g, title, 28, 32, C.text, 800, 25);
  if (sub) txt(g, sub, 28 + measure(g, title, 800, 25) + 14, 32, C.cyan, 600, 21);
  txt(g, 'MET ' + met(state.met), w - 14, 32, C.text, 600, 21, 'right', true);
  g.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 48; y < h; y += 3) g.fillRect(0, y, w, 1);
}
function measure(g, s, wt, px) {
  font(g, wt, px);
  return g.measureText(s).width;
}
function frameLine(g, x, y, w, h) {
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.strokeRect(x + 0.5, y + 0.5, w, h);
}
function warnBanner(g, w, h, text) {
  g.fillStyle = 'rgba(120,8,4,0.92)';
  g.fillRect(0, h - 56, w, 56);
  g.fillStyle = C.red;
  g.fillRect(0, h - 56, w, 3);
  txt(g, 'WARNING', 16, h - 19, '#fff', 800, 26);
  txt(g, text, 150, h - 19, '#ffd9d4', 700, 24);
}
function off(g, w, h) {
  g.fillStyle = '#010203';
  g.fillRect(0, 0, w, h);
  const r = g.createLinearGradient(0, 0, w, h);
  r.addColorStop(0, 'rgba(255,255,255,0.05)');
  r.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
}

// ---------- Pages ----------
function drawTraj(g, w, h, s) {
  base(g, w, h, 'TRAJ', 'FREE RETURN', s);
  const px = 18;
  const py = 58;
  const pw = 420;
  const ph = h - py - (s.alarm ? 70 : 16);
  frameLine(g, px, py, pw, ph);
  // Earth, Moon and the figure-eight free-return path.
  const ex = px + 70;
  const ey = py + ph * 0.55;
  const mx = px + pw - 70;
  const my = py + ph * 0.45;
  const eg = g.createRadialGradient(ex - 10, ey - 10, 2, ex, ey, 34);
  eg.addColorStop(0, '#9fd2ff');
  eg.addColorStop(1, '#1d5aa6');
  g.fillStyle = eg;
  g.beginPath();
  g.arc(ex, ey, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#9aa0a6';
  g.beginPath();
  g.arc(mx, my, 13, 0, Math.PI * 2);
  g.fill();
  txt(g, 'EARTH', ex, ey + 54, C.dim, 600, 17, 'center');
  txt(g, 'MOON', mx, my + 36, C.dim, 600, 17, 'center');
  const path = (k0, k1, dashed, color) => {
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.setLineDash(dashed ? [9, 7] : []);
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const k = k0 + ((k1 - k0) * i) / 60;
      const p = figure8(k, ex, ey, mx, my);
      i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
    }
    g.stroke();
    g.setLineDash([]);
  };
  const now = 0.36;
  path(0, now, false, C.cyan);
  path(now, 1, true, 'rgba(98,210,255,0.5)');
  const p = figure8(now, ex, ey, mx, my);
  const q = figure8(now + 0.01, ex, ey, mx, my);
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
  g.save();
  g.translate(p[0], p[1]);
  g.rotate(a);
  g.fillStyle = s.alarm ? C.amber : C.green;
  g.beginPath();
  g.moveTo(12, 0);
  g.lineTo(-8, -8);
  g.lineTo(-8, 8);
  g.closePath();
  g.fill();
  g.restore();
  // Pericynthion marker.
  const pc = figure8(0.5, ex, ey, mx, my);
  g.strokeStyle = C.magenta;
  g.lineWidth = 2;
  g.strokeRect(pc[0] - 6, pc[1] - 6, 12, 12);
  // Data column.
  const dx = px + pw + 18;
  let y = py + 30;
  const row = (k, v, color = C.text) => {
    txt(g, k, dx, y, C.dim, 600, 18);
    txt(g, v, w - 16, y + 26, color, 700, 25, 'right', true);
    y += 62;
  };
  row('RANGE EARTH', `${(321860 + s.met * 0.9).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`);
  row('VELOCITY', '1.37 km/s');
  row('TO MOON', '58 140 km');
  row('PERICYNTHION', '254 km', C.magenta);
  row('LOS', '078:21:04', s.alarm ? C.amber : C.text);
  if (s.alarm) warnBanner(g, w, h, 'O2 TANK 2  PRESS LOW');
}
function figure8(k, ex, ey, mx, my) {
  // Out above, round the Moon's far side, back below.
  const t = k * Math.PI * 2;
  const cx = (ex + mx) / 2;
  const cy = (ey + my) / 2;
  const ax = (mx - ex) / 2 + 26;
  const x = cx - Math.cos(t * 0.5) * ax;
  const y = cy - Math.sin(t) * 46 + (k > 0.5 ? 10 : -6);
  return [x, y];
}

function drawEPS(g, w, h, s) {
  base(g, w, h, 'EPS', 'POWER', s);
  const load = s.loadAmps;
  const busB = s.alarm || s.tankLost ? 0 : 28.4;
  let y = 84;
  const bus = (name, v, a, ok) => {
    frameLine(g, 18, y - 30, 300, 66);
    txt(g, name, 30, y - 2, C.dim, 700, 19);
    txt(g, v.toFixed(1) + ' V', 30, y + 28, ok ? C.green : C.red, 700, 27, 'left', true);
    txt(g, a, 306, y + 28, ok ? C.text : C.red, 600, 22, 'right', true);
    y += 82;
  };
  bus('MAIN BUS A', 28.6 - (s.alarm ? 0.9 : 0), load.toFixed(1) + ' A', true);
  bus('MAIN BUS B', busB, busB ? '31.0 A' : 'UNDERVOLT', !!busB);
  // Batteries.
  txt(g, 'BATTERY', 30, y + 2, C.dim, 700, 19);
  y += 14;
  for (let i = 0; i < 4; i++) {
    const lv = clamp(s.battery - i * 0.04);
    const bx = 30 + i * 72;
    frameLine(g, bx, y, 56, 108);
    g.fillStyle = lv < 0.25 ? C.red : lv < 0.5 ? C.amber : C.green;
    g.fillRect(bx + 5, y + 5 + 98 * (1 - lv), 47, 98 * lv);
    txt(g, 'B' + (i + 1), bx + 28, y + 132, C.dim, 600, 17, 'center');
  }
  // Big projection.
  const lifeH = (s.battery * 400) / Math.max(18, load);
  const hh = Math.floor(lifeH);
  const mm = Math.floor((lifeH - hh) * 60);
  frameLine(g, 340, 54, w - 358, 160);
  txt(g, 'BATTERY LIFE AT THIS LOAD', 356, 86, C.dim, 700, 19);
  txt(g, `${pad2(hh)}:${pad2(mm)}`, 356, 168, lifeH < 12 ? C.amber : C.green, 800, 78, 'left', true);
  txt(g, 'h', 356 + measure(g, '00:00', 800, 78) * 0.98 + 8, 168, C.dim, 700, 26);
  txt(g, 'NEED 96:00 TO HOME', 356, 202, lifeH < 96 ? C.red : C.green, 700, 20);
  // Load history graph.
  const gx = 340;
  const gy = 232;
  const gw = w - 358;
  const gh = h - gy - (s.alarm ? 72 : 20);
  frameLine(g, gx, gy, gw, gh);
  txt(g, 'LOAD  A', gx + 12, gy + 26, C.dim, 700, 18);
  g.strokeStyle = 'rgba(98,210,255,0.15)';
  g.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(gx, gy + (gh * i) / 4);
    g.lineTo(gx + gw, gy + (gh * i) / 4);
    g.stroke();
  }
  g.strokeStyle = C.cyan;
  g.lineWidth = 2.5;
  g.beginPath();
  const hist = s.loadHist;
  hist.forEach((v, i) => {
    const x = gx + 6 + ((gw - 12) * i) / (hist.length - 1);
    const yy = gy + gh - 8 - (gh - 40) * clamp(v / 90);
    i ? g.lineTo(x, yy) : g.moveTo(x, yy);
  });
  g.stroke();
  txt(g, `OPEN ${s.openCount}/8`, gx + gw - 12, gy + 26, s.openCount ? C.amber : C.dim, 700, 18, 'right');
  if (s.alarm) warnBanner(g, w, h, 'MAIN B UNDERVOLT');
}

function drawECLSS(g, w, h, s) {
  base(g, w, h, 'ECLSS', 'LIFE SUPPORT', s);
  const co2 = s.co2 * 30;
  const cc = co2 >= 15 ? C.red : co2 >= 8 ? C.amber : C.green;
  frameLine(g, 18, 56, 300, 168);
  txt(g, 'ppCO2', 32, 88, C.dim, 700, 20);
  txt(g, co2.toFixed(1), 32, 176, cc, 800, 86, 'left', true);
  txt(g, 'mmHg', 300, 176, C.dim, 700, 22, 'right');
  txt(g, co2 >= 15 ? 'SCRUBBER SAT' : co2 >= 8 ? 'RISING' : 'NOMINAL', 32, 210, cc, 700, 20);
  // Trend.
  const gx = 336;
  const gy = 56;
  const gw = w - 354;
  const gh = 168;
  frameLine(g, gx, gy, gw, gh);
  txt(g, 'CO2 TREND  6 h', gx + 12, gy + 26, C.dim, 700, 17);
  const lim = gy + gh - 8 - (gh - 40) * (15 / 30);
  g.strokeStyle = 'rgba(255,70,54,0.6)';
  g.setLineDash([6, 5]);
  g.beginPath();
  g.moveTo(gx, lim);
  g.lineTo(gx + gw, lim);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = cc;
  g.lineWidth = 3;
  g.beginPath();
  s.co2Hist.forEach((v, i) => {
    const x = gx + 6 + ((gw - 12) * i) / (s.co2Hist.length - 1);
    const yy = gy + gh - 8 - (gh - 40) * clamp(v);
    i ? g.lineTo(x, yy) : g.moveTo(x, yy);
  });
  g.stroke();
  // Rows.
  let y = 262;
  const row = (k, v, color, x0) => {
    txt(g, k, x0, y, C.dim, 600, 19);
    txt(g, v, x0 + 296, y, color || C.text, 700, 23, 'right', true);
  };
  const temp = 21 - (1 - s.power) * 9;
  row('CABIN P', '101.2 kPa', C.text, 22);
  row('O2 TK 1', s.tankLost ? '61 %' : '88 %', s.tankLost ? C.amber : C.green, 350);
  y += 40;
  row('ppO2', '21.3 kPa', C.text, 22);
  row('O2 TK 2', s.tankLost ? '0 %' : '87 %', s.tankLost ? C.red : C.green, 350);
  y += 40;
  row('TEMP', temp.toFixed(0) + ' °C', temp < 14 ? C.cyan : C.text, 22);
  row('O2 FLOW', s.valve > 0.5 ? 'CLOSED' : s.tankLost ? '1.9 kg/h' : '0.4 kg/h', s.valve > 0.5 ? C.green : s.tankLost ? C.red : C.text, 350);
  if (s.alarm) warnBanner(g, w, h, 'O2 TANK 2  CRYO PRESS');
}

const CW = [
  ['O2 TK 2', 'red', (s) => s.alarm || s.tankLost],
  ['MAIN B', 'red', (s) => s.alarm || s.tankLost],
  ['CRYO P', 'amber', (s) => s.alarm],
  ['SM PWR', 'amber', (s) => s.tankLost],
  ['CO2 HI', 'red', (s) => s.co2 * 30 >= 15],
  ['CO2 PP', 'amber', (s) => s.co2 * 30 >= 8],
  ['CABIN P', 'amber', () => false],
  ['O2 FLOW', 'amber', (s) => s.alarm && s.valve < 0.5],
  ['BAT LOW', 'amber', (s) => s.battery < 0.3],
  ['GLY TEMP', 'amber', (s) => s.power < 0.4],
  ['FAN 2', 'amber', (s) => s.breakerOpen[2]],
  ['CMPTR', 'amber', (s) => s.breakerOpen[3]],
  ['COMM', 'amber', () => false],
  ['ATT CTL', 'amber', (s) => s.alarm],
  ['H2 TK 1', 'amber', () => false],
  ['IMU', 'amber', () => false],
  ['RCS', 'amber', () => false],
  ['SUIT P', 'amber', () => false],
];
function drawCW(g, w, h, s) {
  g.fillStyle = '#0c0f12';
  g.fillRect(0, 0, w, h);
  const cols = 6;
  const rows = 3;
  const tw = w / cols;
  const th = h / rows;
  CW.forEach(([name, kind, test], i) => {
    const x = (i % cols) * tw;
    const y = Math.floor(i / cols) * th;
    const on = s.power > 0.04 && !!test(s);
    g.fillStyle = on ? (kind === 'red' ? '#ff3a26' : '#ffb21e') : '#1a1e22';
    g.fillRect(x + 4, y + 4, tw - 8, th - 8);
    if (on) {
      const gl = g.createRadialGradient(x + tw / 2, y + th / 2, 2, x + tw / 2, y + th / 2, tw * 0.6);
      gl.addColorStop(0, 'rgba(255,255,230,0.55)');
      gl.addColorStop(1, 'rgba(255,255,230,0)');
      g.fillStyle = gl;
      g.fillRect(x + 4, y + 4, tw - 8, th - 8);
    }
    txt(g, name, x + tw / 2, y + th / 2 + 6, on ? '#1a0a00' : '#59636b', 800, 15, 'center');
  });
}

function drawLapA(g, w, h, s) {
  // The procedure page for the CO2 adapter: a square cartridge to a round port.
  g.fillStyle = '#eef1f2';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#20476b';
  g.fillRect(0, 0, w, 34);
  txt(g, 'PROC 2.14  CO2 ADAPTER', 12, 24, '#fff', 700, 19);
  txt(g, 'p 3/5', w - 10, 24, '#cfe3f5', 600, 16, 'right');
  const steps = ['Cut hose to 40 cm', 'Wrap card around cartridge', 'Seal with tape, 3 turns', 'Bag over the inlet', 'Push hose to the port'];
  steps.forEach((t, i) => {
    const y = 62 + i * 30;
    const done = i < 2;
    g.strokeStyle = '#30475a';
    g.lineWidth = 2;
    g.strokeRect(12, y - 16, 18, 18);
    if (done) {
      g.strokeStyle = '#1b8a4a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(15, y - 7);
      g.lineTo(20, y - 1);
      g.lineTo(29, y - 15);
      g.stroke();
    }
    txt(g, `${i + 1}. ${t}`, 40, y, done ? '#7a8790' : '#13202b', 600, 18);
  });
  // Sketch: square box, round port, a hose.
  g.strokeStyle = '#13202b';
  g.lineWidth = 3;
  g.strokeRect(330, 70, 74, 74);
  g.beginPath();
  g.arc(470, 230, 26, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([6, 5]);
  g.beginPath();
  g.moveTo(367, 144);
  g.bezierCurveTo(367, 220, 420, 230, 444, 230);
  g.stroke();
  g.setLineDash([]);
  txt(g, 'SQUARE', 367, 166, '#30475a', 700, 14, 'center');
  txt(g, 'ROUND', 470, 276, '#30475a', 700, 14, 'center');
  g.fillStyle = '#d9e2e7';
  g.fillRect(0, h - 30, w, 30);
  txt(g, 'BATTERY 41 %   NO NETWORK', 12, h - 10, '#4a5a66', 600, 15);
}
function drawLapB(g, w, h, s) {
  g.fillStyle = '#071017';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#10222e';
  g.fillRect(0, 0, w, 34);
  txt(g, 'IBIS  STACK STATUS', 12, 24, C.text, 700, 19);
  txt(g, 'MET ' + met(s.met), w - 10, 24, C.cyan, 600, 16, 'right', true);
  // Stack schematic: capsule cone, tunnel, habitat.
  g.strokeStyle = C.cyan;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(40, 80);
  g.lineTo(40, 180);
  g.lineTo(120, 150);
  g.lineTo(120, 110);
  g.closePath();
  g.stroke();
  g.strokeRect(120, 118, 60, 24);
  g.strokeRect(180, 86, 220, 88);
  g.strokeStyle = s.tankLost ? C.red : C.dim;
  g.strokeRect(14, 96, 26, 68);
  txt(g, 'SM', 27, 196, s.tankLost ? C.red : C.dim, 700, 14, 'center');
  txt(g, 'LANTERN', 80, 214, C.dim, 700, 14, 'center');
  txt(g, 'IBIS', 290, 136, C.text, 800, 22, 'center');
  const co2 = s.co2 * 30;
  txt(g, `CO2 ${co2.toFixed(1)} mmHg`, 14, 252, co2 >= 15 ? C.red : co2 >= 8 ? C.amber : C.green, 700, 20, 'left', true);
  txt(g, `PWR ${(s.power * 100).toFixed(0)} %`, 260, 252, s.power < 0.4 ? C.amber : C.text, 700, 20, 'left', true);
  txt(g, 'S-BAND  NO SIGNAL', 14, 292, C.amber, 700, 18);
}
function drawBreakers(g, w, h, s, from) {
  g.fillStyle = '#0a1a0f';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(80,255,140,0.05)';
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  const lit = '#7dffb0';
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const b = BREAKERS[from + i];
    const open = s.breakerOpen[from + i];
    const a = open ? 0 : b.amps;
    total += a;
    const x = 8 + i * 110;
    txt(g, `CB${b.n}`, x, 32, open ? '#2c5a3a' : lit, 700, 22, 'left', true);
    txt(g, a.toFixed(1) + 'A', x, 70, open ? '#2c5a3a' : lit, 700, 28, 'left', true);
  }
  txt(g, `BUS ${from ? 'IBIS' : 'A'}  ${total.toFixed(1)} A`, 8, 102, lit, 600, 20, 'left', true);
}
function drawHab(g, w, h, s) {
  base(g, w, h, 'IBIS', 'HAB', s);
  const co2 = s.co2 * 30;
  let y = 96;
  const row = (k, v, c) => {
    txt(g, k, 18, y, C.dim, 600, 21);
    txt(g, v, w - 18, y, c || C.text, 700, 27, 'right', true);
    y += 48;
  };
  row('CABIN P', '101.1 kPa');
  row('CO2', co2.toFixed(1) + ' mmHg', co2 >= 15 ? C.red : co2 >= 8 ? C.amber : C.green);
  row('TEMP', (20 - (1 - s.power) * 10).toFixed(0) + ' °C');
  row('HAB BUS', s.breakerOpen[4] && s.breakerOpen[5] ? 'SHED' : '27.9 V', s.alarm ? C.amber : C.green);
}

// ---------- The atlas ----------
export function createScreens(o = {}) {
  const low = o.tier === 'low';
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const r = rng(21);
  const state = {
    met: 55 * 3600 + 54 * 60 + 40,
    alarm: false,
    tankLost: false,
    power: 1,
    co2: 0.12,
    valve: 0,
    battery: 0.94,
    breakerOpen: [false, false, false, false, false, false, false, false],
    loadAmps: 0,
    loadHist: [],
    co2Hist: [],
  };
  for (let i = 0; i < 40; i++) state.loadHist.push(48 + Math.sin(i * 0.7) * 4 + r() * 3);
  for (let i = 0; i < 40; i++) state.co2Hist.push(0.1 + i * 0.0006 + r() * 0.01);
  const regions = {};
  for (const k in R) {
    const [x, y, w, h] = R[k];
    regions[k] = { u0: (x + 1) / W, v0: 1 - (y + h - 1) / H, u1: (x + w - 1) / W, v1: 1 - (y + 1) / H, aspect: w / h };
  }
  const on = {
    d0: () => state.power > 0.42,
    d1: () => state.power > 0.08,
    d2: () => state.power > 0.24,
    cw: () => true,
    lapA: () => true,
    lapB: () => true,
    brk1: () => state.power > 0.03,
    brk2: () => state.power > 0.03,
    hab: () => state.power > 0.62,
  };
  const draw = { d0: drawTraj, d1: drawEPS, d2: drawECLSS, cw: drawCW, lapA: drawLapA, lapB: drawLapB, brk1: (g2, w, h, s) => drawBreakers(g2, w, h, s, 0), brk2: (g2, w, h, s) => drawBreakers(g2, w, h, s, 4), hab: drawHab };
  const dirty = new Set(Object.keys(R));
  function paint(k) {
    const [x, y, w, h] = R[k];
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.translate(x, y);
    if (on[k]()) draw[k](g, w, h, state);
    else off(g, w, h);
    g.restore();
  }
  function computeLoad() {
    state.openCount = state.breakerOpen.filter(Boolean).length;
    let a = 22;
    BREAKERS.forEach((b, i) => {
      if (!state.breakerOpen[i]) a += b.amps;
    });
    state.loadAmps = a * (0.35 + 0.65 * state.power);
  }
  let since = 0;
  let clock = 0;
  let lastOn = '';
  const api = {
    texture,
    regions,
    state,
    // set({ alarm, power, co2, valve, breaker: [i, open] ... }) marks pages dirty.
    set(p) {
      let any = false;
      for (const k in p) {
        if (k === 'breaker') {
          const [i, open] = p.breaker;
          if (state.breakerOpen[i] !== open) {
            state.breakerOpen[i] = open;
            any = true;
          }
        } else if (state[k] !== p[k]) {
          state[k] = p[k];
          any = true;
        }
      }
      if (p.alarm) state.tankLost = true;
      if (any) {
        computeLoad();
        ['d0', 'd1', 'd2', 'cw', 'lapB', 'brk1', 'brk2', 'hab'].forEach((k) => dirty.add(k));
      }
    },
    redrawAll() {
      Object.keys(R).forEach((k) => dirty.add(k));
    },
    update(dt) {
      since += dt;
      clock += dt;
      if (clock >= 1) {
        clock -= 1;
        state.met += 1;
        if (state.met % 20 === 0) {
          state.loadHist.push(state.loadAmps * (0.97 + Math.random() * 0.06));
          state.loadHist.shift();
          state.co2Hist.push(state.co2);
          state.co2Hist.shift();
          dirty.add('d1');
          dirty.add('d2');
        }
        dirty.add('d0');
        if (!low) dirty.add('lapB');
      }
      const onKey = Object.keys(on)
        .map((k) => (on[k]() ? 1 : 0))
        .join('');
      if (onKey !== lastOn) {
        lastOn = onKey;
        Object.keys(R).forEach((k) => dirty.add(k));
      }
      if (dirty.size && since >= (low ? 0.5 : 0.2)) {
        since = 0;
        dirty.forEach(paint);
        dirty.clear();
        texture.needsUpdate = true;
      }
    },
  };
  computeLoad();
  return api;
}
