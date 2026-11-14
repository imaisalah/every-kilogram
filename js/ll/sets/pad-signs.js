// Every sign, plaque and label of the pad set in one 1024 x 1024 atlas (one
// material, one draw call per merged mesh). No agency logos anywhere.
import { THREE, canvasTex } from './common.js';
import { font } from './pad-kit.js';

// Atlas cells in pixels: [x, y, w, h] (y from the top).
const CELLS = {
  whiteroom: [0, 0, 1024, 128],
  elevator: [0, 128, 1024, 128],
  level: [0, 256, 1024, 128],
  hatch: [0, 384, 1024, 128],
  walkway: [0, 512, 512, 256],
  danger: [512, 512, 512, 256],
  plaque: [0, 768, 512, 256],
  o2: [512, 768, 256, 128],
  co2: [768, 768, 256, 128],
  cam: [512, 896, 256, 128],
  door: [768, 896, 256, 128],
};

function label(g, [x, y, w, h], title, sub, stripe, dark) {
  g.fillStyle = dark ? '#1b1d20' : '#f1f2ee';
  g.fillRect(x, y, w, h);
  g.fillStyle = stripe;
  g.fillRect(x, y, w, 26);
  g.fillRect(x, y + h - 10, w, 10);
  g.fillStyle = dark ? '#e9e9e4' : '#16181b';
  g.font = font(30, 700);
  g.fillText(title, x + 12, y + 66);
  g.font = font(17, 500);
  g.fillText(sub, x + 12, y + 96);
}

export function signAtlas() {
  const tex = canvasTex(1024, 1024, (g) => {
    const c = CELLS;
    let [x, y, w, h] = c.whiteroom;
    g.fillStyle = '#f4f4ef';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#123c69';
    g.fillRect(x, y, w, 20);
    g.fillStyle = '#0f1216';
    g.font = font(54, 700);
    g.fillText('WHITE ROOM', 30, y + 82);
    g.font = font(26, 500);
    g.fillText('Closeout crew only · No loose items', 30, y + 116);
    [x, y, w, h] = c.elevator;
    g.fillStyle = '#e2b416';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#121316';
    g.font = font(58, 700);
    g.fillText('ELEVATOR 1', 30, y + 82);
    g.font = font(28, 600);
    g.fillText('L0 · L92 crew access', 520, y + 82);
    [x, y, w, h] = c.level;
    g.fillStyle = '#121316';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#e9e6dc';
    g.font = font(74, 700);
    g.fillText('L 92', 30, y + 94);
    g.font = font(30, 500);
    g.fillText('Crew access arm  →', 330, y + 84);
    [x, y, w, h] = c.hatch;
    g.fillStyle = '#c0261f';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#ffffff';
    g.font = font(46, 700);
    g.fillText('HATCH · WATCH YOUR HEAD', 30, y + 81);
    [x, y, w, h] = c.walkway;
    g.fillStyle = '#e2b416';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#121316';
    g.font = font(46, 700);
    g.fillText('CREW WALKWAY', x + 26, y + 90);
    g.font = font(30, 600);
    g.fillText('Tower · elevator 1  ←', x + 26, y + 150);
    g.font = font(22, 500);
    g.fillText('Hard hats beyond this point', x + 26, y + 210);
    [x, y, w, h] = c.danger;
    g.fillStyle = '#b8231c';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#ffffff';
    g.font = font(46, 700);
    g.fillText('DANGER', x + 26, y + 90);
    g.font = font(28, 600);
    g.fillText('Cryogenic lines · do not touch', x + 26, y + 150);
    g.fillText('Oxygen-rich area · no flames', x + 26, y + 200);
    [x, y, w, h] = c.plaque;
    g.fillStyle = '#2c2a26';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#b8954c';
    g.lineWidth = 8;
    g.strokeRect(x + 10, y + 10, w - 20, h - 20);
    g.fillStyle = '#d9b868';
    g.textAlign = 'center';
    g.font = font(30, 700);
    g.fillText('IN MEMORY OF THE CREWS', x + w / 2, y + 70);
    g.font = font(22, 500);
    g.fillText('Apollo 1 · Challenger · Columbia', x + w / 2, y + 120);
    g.font = font(20, 500);
    g.fillText('They reached for the sky.', x + w / 2, y + 170);
    g.fillText('We remember, and we check again.', x + w / 2, y + 200);
    g.textAlign = 'start';
    label(g, c.o2, 'OXYGEN', 'O2 · 40 kg · 3000 psi', '#1f9d55', false);
    label(g, c.co2, 'LiOH  CO2', 'Spare cartridges · 6', '#d4a017', false);
    label(g, c.cam, 'CAMERA', 'Hi-res · lenses · 40 kg', '#e0b31a', true);
    [x, y, w, h] = c.door;
    g.fillStyle = '#1f6f3a';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#ffffff';
    g.font = font(28, 700);
    g.fillText('CLEAN AREA', x + 14, y + 48);
    g.font = font(18, 500);
    g.fillText('Gloves on. Nothing', x + 14, y + 80);
    g.fillText('loose past this door.', x + 14, y + 104);
  });
  tex.anisotropy = 8;
  return tex;
}

// A plane of size w x h showing one atlas cell.
export function signPlane(name, w, h) {
  const [x, y, cw, ch] = CELLS[name];
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, (x + u * cw) / 1024, 1 - (y + (1 - v) * ch) / 1024);
  }
  return g;
}
