// Builds a 3D spacecraft from the design. 1 unit = 1 metre.
// Frame: engine at -Y, high-gain dish at +Y, instruments look out of -Z,
// solar wings along +-X.
// Looks like flight hardware without costing much: crinkled multi-layer
// insulation (MLI) foil, mirror-tile radiators, framed solar cells with hinges,
// a dish with its feed tripod, thruster clusters on the corners, star trackers.
// Every texture is drawn once and shared; geometry is per craft (the designer
// disposes old crafts' geometry).
import { THREE } from './engine.js';
import { canvasTex } from './assets.js';

const TAU = Math.PI * 2;
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// Crinkled foil: overlapping facets of random brightness, with tape seams.
function facetCanvas(ctx, w, h, base, spread, seams) {
  seed = 11;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = 6 + rnd() * 22;
    const n = 3 + Math.floor(rnd() * 3);
    const g = Math.round(128 + (rnd() - 0.5) * spread);
    ctx.fillStyle = `rgba(${g},${g},${g},0.55)`;
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + rnd() * 0.8;
      const rr = r * (0.5 + rnd() * 0.7);
      const x = cx + Math.cos(a) * rr * 1.6;
      const y = cy + Math.sin(a) * rr;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (seams) {
    ctx.fillStyle = seams;
    for (let k = 1; k < 3; k++) ctx.fillRect(0, (k / 3) * h - 3, w, 6);
    ctx.fillRect(w * 0.5 - 3, 0, 6, h);
  }
}

let shared = null;
function materials() {
  if (shared) return shared;
  const rep = (t, x, y) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(x, y);
    t.anisotropy = 4;
    return t;
  };
  const foilBump = rep(canvasTex(256, 256, (c, w, h) => facetCanvas(c, w, h, '#808080', 150, 'rgba(200,200,200,0.9)'), false), 1, 1);
  // Gold kapton: warm, uneven, lighter where the tape covers the seams.
  const goldMap = rep(
    canvasTex(256, 256, (c, w, h) => {
      facetCanvas(c, w, h, '#c79a34', 70, null);
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = '#e0a93a';
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(255,226,150,0.55)';
      for (let k = 1; k < 3; k++) c.fillRect(0, (k / 3) * h - 3, w, 6);
      c.fillRect(w * 0.5 - 3, 0, 6, h);
    }),
    1,
    1
  );
  // Optical solar reflector radiator: a grid of small mirror tiles.
  const osr = rep(
    canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#8d959d';
      c.fillRect(0, 0, w, h);
      const n = 12;
      seed = 5;
      for (let a = 0; a < n; a++)
        for (let b = 0; b < n; b++) {
          const g = 168 + Math.floor(rnd() * 22);
          c.fillStyle = `rgb(${g},${g + 3},${g + 6})`;
          c.fillRect((a * w) / n + 1, (b * h) / n + 1, w / n - 2, h / n - 2);
        }
    }),
    1,
    1
  );
  // Solar cells: dark blue with clipped corners, silver fingers and busbars,
  // white substrate in the gaps.
  const cells = rep(
    canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#c9d0d6';
      c.fillRect(0, 0, w, h);
      const nx = 4;
      const ny = 8;
      const cw = w / nx;
      const ch = h / ny;
      seed = 3;
      for (let a = 0; a < nx; a++)
        for (let b = 0; b < ny; b++) {
          const x = a * cw + 2;
          const y = b * ch + 2;
          const W = cw - 4;
          const H = ch - 4;
          const k = 5;
          const v = Math.floor(rnd() * 10);
          c.fillStyle = `rgb(${16 + v},${30 + v},${66 + v * 2})`;
          c.beginPath();
          c.moveTo(x + k, y);
          c.lineTo(x + W - k, y);
          c.lineTo(x + W, y + k);
          c.lineTo(x + W, y + H - k);
          c.lineTo(x + W - k, y + H);
          c.lineTo(x + k, y + H);
          c.lineTo(x, y + H - k);
          c.lineTo(x, y + k);
          c.closePath();
          c.fill();
          c.strokeStyle = 'rgba(170,190,215,0.35)';
          c.lineWidth = 1;
          for (let f = 1; f < 6; f++) {
            c.beginPath();
            c.moveTo(x + 2, y + (f * H) / 6);
            c.lineTo(x + W - 2, y + (f * H) / 6);
            c.stroke();
          }
          c.fillStyle = 'rgba(205,215,228,0.8)';
          c.fillRect(x + W * 0.3, y + 1, 2, H - 2);
          c.fillRect(x + W * 0.7, y + 1, 2, H - 2);
        }
    }),
    1,
    1
  );
  // Radar panel: rows of radiating patches.
  const patches = rep(
    canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#e8ecef';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#b9c2ca';
      for (let a = 0; a < 24; a++) for (let b = 0; b < 6; b++) c.fillRect(a * (w / 24) + 3, b * (h / 6) + 4, w / 24 - 6, h / 6 - 8);
      c.fillStyle = '#9aa5ae';
      for (let a = 1; a < 4; a++) c.fillRect((a * w) / 4 - 1, 0, 2, h);
    }),
    1,
    1
  );
  const M = {
    foil: new THREE.MeshStandardMaterial({ map: goldMap, color: 0xffffff, metalness: 0.75, roughness: 0.32, bumpMap: foilBump, bumpScale: 1.2, emissive: 0x2a1a04, emissiveIntensity: 0.5 }),
    foilSilver: new THREE.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 0.9, roughness: 0.28, bumpMap: foilBump, bumpScale: 1.2 }),
    foilDark: new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.35, roughness: 0.45, bumpMap: foilBump, bumpScale: 1 }),
    radiator: new THREE.MeshStandardMaterial({ map: osr, metalness: 0.7, roughness: 0.2 }),
    panel: new THREE.MeshStandardMaterial({ map: cells, metalness: 0.35, roughness: 0.32 }),
    panelBack: new THREE.MeshStandardMaterial({ color: 0x9ea6ae, metalness: 0.6, roughness: 0.55 }),
    sar: new THREE.MeshStandardMaterial({ map: patches, metalness: 0.15, roughness: 0.5 }),
    white: new THREE.MeshStandardMaterial({ color: 0xe9eef2, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide }),
    dishIn: new THREE.MeshStandardMaterial({ color: 0xf2f4f5, metalness: 0.05, roughness: 0.4, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: 0x5b636c, metalness: 0.8, roughness: 0.38 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3b4047, metalness: 0.7, roughness: 0.45 }),
    titanium: new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.85, roughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.2, roughness: 0.3, side: THREE.DoubleSide }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0b1420, metalness: 1, roughness: 0.06 }),
    rtg: new THREE.MeshStandardMaterial({ color: 0x4a4f55, metalness: 0.6, roughness: 0.5 }),
    tank: new THREE.MeshStandardMaterial({ color: 0xc9d0d6, metalness: 0.8, roughness: 0.22 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x4a4542, metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }),
  };
  Object.values(M).forEach((m) => (m.userData.keep = true));
  shared = M;
  return M;
}

const cbrt = Math.cbrt;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};
// A rod from a to b (Vector3s).
function rod(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
// Bell nozzle, exit down (-Y) at y = 0.
function bell(re, len, mat) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push(new THREE.Vector2(re * (0.3 + 0.7 * Math.pow(1 - k, 1.7)), k * len));
  }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mat);
}

// ---------- Crew capsule (Orion-like) ----------
// Crew module (a 5 m cone with the heat shield underneath), the service module
// with four solar wings in an X, and, when the design has one, the launch abort
// tower with its fairing over the capsule. Real sizes in metres.
let crewShared = null;
function crewMaterials() {
  if (crewShared) return crewShared;
  // Back-shell tiles: a grid of slightly different silvers.
  const tiles = canvasTex(256, 256, (c, w, h) => {
    seed = 21;
    c.fillStyle = '#9da5ad';
    c.fillRect(0, 0, w, h);
    const n = 16;
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++) {
        const g = 160 + Math.floor(rnd() * 34);
        c.fillStyle = `rgb(${g},${g + 2},${g + 5})`;
        c.fillRect((a * w) / n + 1, (b * h) / n + 1, w / n - 2, h / n - 2);
      }
  });
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.repeat.set(3, 1);
  // Ablator: a honeycomb of brown blocks.
  const ablator = canvasTex(256, 256, (c, w, h) => {
    seed = 33;
    c.fillStyle = '#4a3326';
    c.fillRect(0, 0, w, h);
    for (let a = 0; a < 18; a++)
      for (let b = 0; b < 18; b++) {
        const v = Math.floor(rnd() * 26);
        c.fillStyle = `rgb(${92 + v},${64 + v * 0.7},${44 + v * 0.5})`;
        c.fillRect((a * w) / 18 + 1, (b * h) / 18 + 1, w / 18 - 2, h / 18 - 2);
      }
  });
  const C = {
    tiles: new THREE.MeshStandardMaterial({ map: tiles, metalness: 0.55, roughness: 0.42 }),
    ablator: new THREE.MeshStandardMaterial({ map: ablator, metalness: 0.05, roughness: 0.9 }),
    smWhite: new THREE.MeshStandardMaterial({ color: 0xe9edf0, metalness: 0.15, roughness: 0.6 }),
    lasWhite: new THREE.MeshStandardMaterial({ color: 0xf1f3f4, metalness: 0.05, roughness: 0.45 }),
    window: new THREE.MeshStandardMaterial({ color: 0x0d1724, metalness: 1, roughness: 0.05 }),
    red: new THREE.MeshStandardMaterial({ color: 0xb4302c, metalness: 0.2, roughness: 0.5 }),
  };
  Object.values(C).forEach((m) => (m.userData.keep = true));
  crewShared = C;
  return C;
}

function buildCrewCraft(design, info = {}) {
  const M = materials();
  const C = crewMaterials();
  const root = new THREE.Group();
  const parts = {};
  const add = (key, obj) => {
    obj.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    const holder = new THREE.Group();
    holder.add(obj);
    root.add(holder);
    parts[key] = holder;
    return holder;
  };
  const R = 2.51; // crew module base radius (5.02 m)
  const cmH = 3.3;
  const smR = 2.05;
  const smH = 2.8;
  // Service module, top at y = 0.
  const sm = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(smR, smR, smH, 40), [M.foilSilver, M.foilSilver, M.foilDark]);
  body.position.y = -smH / 2;
  sm.add(body);
  // Radiator panels and the adapter ring to the capsule.
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + TAU / 16;
    const p = mesh(new THREE.BoxGeometry(1.1, smH * 0.7, 0.03), M.radiator, Math.cos(a) * (smR + 0.02), -smH * 0.5, Math.sin(a) * (smR + 0.02));
    p.rotation.y = -a + Math.PI / 2;
    sm.add(p);
  }
  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, smR, 0.45, 40), C.smWhite);
  adapter.position.y = 0.22;
  sm.add(adapter);
  // Main engine and eight auxiliary thrusters.
  const main = bell(0.62, 1.5, M.nozzle);
  main.position.y = -smH - 1.5;
  sm.add(main);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const n = bell(0.12, 0.3, M.nozzle);
    n.position.set(Math.cos(a) * smR * 0.7, -smH - 0.3, Math.sin(a) * smR * 0.7);
    sm.add(n);
  }
  add('sm', sm);
  root.userData.nozzleY = -smH - 1.5;
  // Four solar wings in an X, three panels each, sized by the design's area.
  const area = Math.max(4, design.arrays || 24);
  const wingL = clamp(area / 4 / 2, 2.5, 9);
  const wingW = 2.0;
  for (let k = 0; k < 4; k++) {
    const g = new THREE.Group();
    const segs = 3;
    for (let s = 0; s < segs; s++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(wingL / segs - 0.05, 0.04, wingW), [M.panelBack, M.panelBack, M.panel, M.panelBack, M.panelBack, M.panelBack]);
      panel.position.x = 0.5 + (wingL / segs) * (s + 0.5);
      g.add(panel);
    }
    g.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.5, 0, 0), 0.05, M.metal));
    const a = (k / 4) * TAU + TAU / 8;
    g.rotation.y = -a;
    g.position.set(Math.cos(a) * smR, -smH * 0.55, Math.sin(a) * smR);
    g.children[0].userData.length = wingL;
    add('wing' + k, g);
  }
  root.userData.span = smR * 2 + 2 * (0.5 + wingL);
  // Crew module: cone from the heat shield up to the docking tunnel.
  const cm = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.95, R, cmH, 48, 1), C.tiles);
  cone.position.y = cmH / 2;
  cm.add(cone);
  const tunnel = mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.5, 32), M.metal, 0, cmH + 0.25, 0);
  cm.add(tunnel);
  // Four windows and the hatch, on the cone side that faces +Z.
  const tilt = Math.atan2(R - 0.95, cmH);
  [-0.5, -0.18, 0.18, 0.5].forEach((ang, i) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.05), C.window);
    const y = cmH * (i === 0 || i === 3 ? 0.62 : 0.7);
    const rr = R - (R - 0.95) * (y / cmH) + 0.01;
    w.position.set(Math.sin(ang) * rr, y, Math.cos(ang) * rr);
    w.rotation.set(-tilt, ang, 0);
    cm.add(w);
  });
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.0, 0.05), M.frame);
  const hy = cmH * 0.36;
  const hr = R - (R - 0.95) * (hy / cmH) + 0.02;
  hatch.position.set(0, hy, hr);
  hatch.rotation.x = -tilt;
  cm.add(hatch);
  cm.position.y = 0.45;
  add('capsule', cm);
  // Heat shield: a shallow dish under the capsule, thicker with more ablator.
  const thick = 0.12 + ((design.heatShield || 1350) - 1000) / 3000;
  const hsG = new THREE.Group();
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.96, thick, 48), [C.ablator, C.ablator, C.ablator]);
  shield.position.y = -thick / 2;
  hsG.add(shield);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R * 2.4, 48, 8, 0, TAU, Math.PI - Math.asin(R * 0.96 / (R * 2.4)), Math.asin(R * 0.96 / (R * 2.4))), C.ablator);
  dome.position.y = -thick + R * 2.4 * Math.cos(Math.asin(R * 0.96 / (R * 2.4)));
  hsG.add(dome);
  hsG.position.y = 0.45;
  hsG.visible = !!info.showShield;
  add('heatshield', hsG);
  // Instruments: a camera bracket at the window side.
  const I = design.instruments || [];
  if (I.includes('hires')) {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 20), M.white);
    tube.rotation.x = Math.PI / 2;
    g.add(tube);
    g.position.set(-1.2, 0.45 + cmH * 0.4, 1.9);
    add('hires', g);
  }
  if (I.includes('context')) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.2, 0.25), M.foilSilver));
    g.position.set(1.25, 0.45 + cmH * 0.42, 1.85);
    add('context', g);
  }
  let top = 0.45 + cmH + 0.5;
  // Launch abort system: an ogive fairing over the capsule and the tower.
  if (Number(design.abort)) {
    const las = new THREE.Group();
    const pts = [new THREE.Vector2(R + 0.08, 0), new THREE.Vector2(R + 0.08, 0.6)];
    for (let i = 1; i <= 12; i++) {
      const k = i / 12;
      pts.push(new THREE.Vector2(Math.max(0.45, (R + 0.08) * (1 - k) + 0.45 * k * (1 - k) * 2), 0.6 + k * (cmH + 0.2)));
    }
    const fair = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), C.lasWhite);
    las.add(fair);
    const tower = mesh(new THREE.CylinderGeometry(0.45, 0.5, 5.2, 24), C.lasWhite, 0, cmH + 0.8 + 2.6, 0);
    las.add(tower);
    // Abort motor nozzles, angled out, and the red attitude-control ring.
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + TAU / 8;
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.45, 12, 1, true), M.nozzle);
      n.position.set(Math.cos(a) * 0.5, cmH + 2.0, Math.sin(a) * 0.5);
      n.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      las.add(n);
    }
    las.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.25, 24), C.red, 0, cmH + 4.6, 0));
    const nose = mesh(new THREE.ConeGeometry(0.45, 1.6, 24), C.lasWhite, 0, cmH + 6.2, 0);
    las.add(nose);
    las.position.y = 0.45;
    add('las', las);
    top = 0.45 + cmH + 7.0;
  }
  root.userData.parts = parts;
  root.userData.crew = true;
  root.userData.top = top;
  root.userData.size = Math.max(root.userData.span, top - root.userData.nozzleY);
  return root;
}

// info: { dryKg, propKg } from the model.
export function buildCraft(design, info = {}) {
  if (design && design.mission && globalThis.SMD && SMD.data && SMD.data.MISSIONS[design.mission] && SMD.data.MISSIONS[design.mission].kind === 'crew') return buildCrewCraft(design, info);
  const M = materials();
  const root = new THREE.Group();
  const parts = {};
  const add = (key, obj) => {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const holder = new THREE.Group();
    holder.add(obj);
    root.add(holder);
    parts[key] = holder;
    return holder;
  };
  const fixed = (obj) => {
    obj.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    root.add(obj);
    return obj;
  };

  const dry = info.dryKg || 300;
  const prop = info.propKg || 150;
  const b = clamp(1.4 * cbrt(dry / 350), 1.1, 2.6);
  const bh = b * 1.1;

  // ---------- Bus ----------
  // Faces: +X/-X gold MLI, top silver, bottom dark, +Z radiator, -Z instrument deck.
  const busG = new THREE.Group();
  busG.add(new THREE.Mesh(new THREE.BoxGeometry(b, bh, b), [M.foil, M.foil, M.foilSilver, M.foilDark, M.radiator, M.foilDark]));
  // Frame: corner posts and rims, a little proud of the blankets.
  const e = 0.035;
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      busG.add(mesh(new THREE.BoxGeometry(e * 2, bh + e * 2, e * 2), M.frame, (sx * b) / 2, 0, (sz * b) / 2));
    })
  );
  [-1, 1].forEach((sy) => {
    [-1, 1].forEach((s) => {
      busG.add(mesh(new THREE.BoxGeometry(b + e * 2, e * 2, e * 2), M.frame, 0, (sy * bh) / 2, (s * b) / 2));
      busG.add(mesh(new THREE.BoxGeometry(e * 2, e * 2, b + e * 2), M.frame, (s * b) / 2, (sy * bh) / 2, 0));
    });
  });
  // Star trackers on the top corner, looking up and away from the Sun.
  [0, 1].forEach((k) => {
    const st = new THREE.Group();
    st.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), M.frame));
    const baffle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.22, 14, 1, true), M.black);
    baffle.position.y = 0.16;
    st.add(baffle);
    st.position.set(-b / 2 + 0.18 + k * 0.24, bh / 2 + 0.07, b / 2 - 0.2);
    st.rotation.set(0.45, 0, 0.35 - k * 0.7);
    busG.add(st);
  });
  // Sun sensor and a low-gain antenna.
  busG.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.1), M.glass, b / 2 - 0.16, bh / 2 + 0.03, b / 2 - 0.16));
  const lgaMast = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.35, 6), M.metal, b / 2 - 0.18, -bh / 2 - 0.17, b / 2 - 0.18);
  const lga = mesh(new THREE.ConeGeometry(0.08, 0.12, 14), M.white, b / 2 - 0.18, -bh / 2 - 0.38, b / 2 - 0.18);
  lga.rotation.x = Math.PI;
  busG.add(lgaMast, lga);
  // Thruster clusters on the four lower corners: a block with four nozzles.
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) => {
      const q = new THREE.Group();
      q.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), M.foilSilver));
      [
        [0, -1, 0],
        [sx, 0, 0],
        [0, 0, sz],
        [0, 1, 0],
      ].forEach(([x, y, z]) => {
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 0.08, 10, 1, true), M.nozzle);
        n.position.set(x * 0.09, y * 0.09, z * 0.09);
        n.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(x, y, z));
        q.add(n);
      });
      q.position.set((sx * b) / 2 + sx * 0.06, -bh / 2 + 0.12, (sz * b) / 2 + sz * 0.06);
      busG.add(q);
    })
  );
  add('bus', busG);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(b * 0.42, b * 0.48, 0.12, 32), M.metal);
  ring.position.y = -bh / 2 - 0.06;
  fixed(ring);

  // ---------- Propellant tank and main engine ----------
  // The tank grows with the rocket equation.
  const rt = clamp(0.42 * cbrt(prop / 120), 0.22, 1.9);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(rt, 32, 20), M.tank);
  const weld = new THREE.Mesh(new THREE.TorusGeometry(rt * 1.003, 0.012 + rt * 0.01, 6, 40), M.metal);
  weld.rotation.x = Math.PI / 2;
  tank.add(weld);
  tank.position.y = -bh / 2 - rt * 0.55;
  add('tank', tank); // the designer reads the sphere's radius from here
  const tankY = tank.position.y;
  // Struts from the bus floor down to the tank's equator.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    fixed(rod(new THREE.Vector3(Math.cos(a) * b * 0.36, -bh / 2, Math.sin(a) * b * 0.36), new THREE.Vector3(Math.cos(a) * rt * 0.98, tankY, Math.sin(a) * rt * 0.98), 0.02, M.frame));
  }
  const engG = new THREE.Group();
  const throat = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 14), M.metal, 0, 0.07, 0);
  const nz = bell(0.24, 0.42, M.nozzle);
  nz.position.y = -0.42;
  engG.add(throat, nz);
  engG.position.y = tankY - rt - 0.02;
  fixed(engG);
  root.userData.nozzleY = engG.position.y - 0.42;

  // ---------- Solar wings ----------
  if (design.arrays > 0) {
    const wing = design.arrays / 2;
    const w = clamp(1.1 + design.arrays / 55, 1.1, 2.8);
    const L = wing / w;
    const segs = Math.max(1, Math.round(L / 1.3));
    const segL = L / segs;
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      // Yoke: two arms from the drive to the first panel, and the drive itself.
      const drive = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 16), M.frame);
      drive.rotation.z = Math.PI / 2;
      drive.position.x = side * 0.08;
      g.add(drive);
      [-1, 1].forEach((s) => g.add(rod(new THREE.Vector3(side * 0.12, 0, 0), new THREE.Vector3(side * 0.6, 0, (s * w) / 2.6), 0.022, M.metal)));
      for (let k = 0; k < segs; k++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(segL - 0.06, 0.04, w), [M.panelBack, M.panelBack, M.panel, M.panelBack, M.panelBack, M.panelBack]);
        // One cell texture repeat per ~0.6 m keeps the cells the same size on every wing.
        panel.geometry.attributes.uv.array.forEach((v, i, arr) => (arr[i] = v * (i % 2 ? w / 0.6 : segL / 0.6)));
        panel.position.x = side * (0.6 + segL * (k + 0.5));
        g.add(panel);
        // Hinges between panels.
        if (k > 0)
          [-1, 1].forEach((s) => {
            const hgeo = new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8);
            const h = mesh(hgeo, M.metal, side * (0.6 + segL * k), 0, (s * w) / 3);
            h.rotation.x = Math.PI / 2;
            g.add(h);
          });
      }
      g.position.x = side * (b / 2);
      g.userData.length = L;
      add(side < 0 ? 'arrayL' : 'arrayR', g);
    });
    root.userData.span = b + 2 * (0.6 + L);
  } else root.userData.span = b;

  // ---------- High-gain dish ----------
  const D = design.dish || 1;
  const f = 0.38 * D;
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const r = (D / 2) * (i / 18);
    pts.push(new THREE.Vector2(r, (r * r) / (4 * f)));
  }
  const rimY = (D * D) / 4 / (4 * f);
  const dishG = new THREE.Group();
  dishG.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), M.dishIn));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(D / 2, 0.02 + D * 0.006, 6, 48), M.white);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = rimY;
  dishG.add(rim);
  // Back structure and gimbal.
  const back = mesh(new THREE.CylinderGeometry(D * 0.18, D * 0.08, 0.12 + D * 0.04, 16), M.frame, 0, -0.06, 0);
  dishG.add(back);
  // Feed tripod up to the horn at the focus.
  const focus = new THREE.Vector3(0, f, 0);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + Math.PI / 6;
    dishG.add(rod(new THREE.Vector3(Math.cos(a) * D * 0.46, rimY * 0.93, Math.sin(a) * D * 0.46), focus, 0.012 + D * 0.003, M.white));
  }
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.06 + D * 0.015, 0.035, 0.14 + D * 0.03, 14), M.metal);
  horn.position.y = f - 0.02;
  horn.rotation.x = Math.PI;
  dishG.add(horn);
  const sub = mesh(new THREE.CylinderGeometry(0.05 + D * 0.03, 0.05 + D * 0.03, 0.02, 20), M.white, 0, f + 0.07 + D * 0.015, 0);
  dishG.add(sub);
  dishG.position.y = bh / 2 + 0.25 + (design.shield ? 0.18 + design.shield / 500 : 0);
  add('dish', dishG);
  // Mast from the deck to the dish gimbal.
  fixed(mesh(new THREE.CylinderGeometry(0.05, 0.07, dishG.position.y - bh / 2, 10), M.metal, 0, (dishG.position.y + bh / 2) / 2 - 0.03, 0));

  // ---------- Radiation vault ----------
  if (design.shield) {
    const t = 0.12 + design.shield / 500;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(b * 0.72, t, b * 0.72), M.titanium));
    // Bolted lid edge.
    g.add(mesh(new THREE.BoxGeometry(b * 0.76, 0.03, b * 0.76), M.frame, 0, t / 2, 0));
    g.position.y = bh / 2 + t / 2;
    add('vault', g);
  }

  // ---------- Instruments on the -Z (nadir) face ----------
  const face = -b / 2;
  const I = design.instruments || [];
  if (I.includes('hires')) {
    // Telescope: white-blanketed tube, black sunshade with a slanted lip.
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 28), M.white);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = -0.55;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.3, 0.45, 28, 1, true), M.black);
    shade.rotation.x = Math.PI / 2;
    shade.position.z = -1.3;
    const bandA = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 6, 28), M.frame);
    bandA.position.z = -1.08;
    const bandB = bandA.clone();
    bandB.position.z = -0.2;
    const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28), M.glass);
    mirror.position.z = -1.09;
    mirror.rotation.y = Math.PI;
    g.add(tube, shade, bandA, bandB, mirror);
    // Focal-plane electronics box with its own radiator.
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.22), M.foilSilver, 0, 0.32, -0.25));
    g.add(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.22), M.radiator, 0, 0.48, -0.25));
    g.position.set(b * 0.22, bh * 0.15, face);
    add('hires', g);
  }
  if (I.includes('context')) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.22, 0.3), M.foilSilver, 0, 0, -0.15));
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.12, 18), M.frame);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.36;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.06, 18), M.glass);
    lens.position.z = -0.421;
    lens.rotation.y = Math.PI;
    g.add(barrel, lens);
    g.position.set(-b * 0.28, bh * 0.28, face);
    add('context', g);
  }
  if (I.includes('irspec')) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.42, 0.34, 0.4), M.foil, 0, 0, -0.2));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), M.black, 0, 0.02, -0.41));
    // Cooler fins: the detector must stay cold.
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.012, 0.3, 0.32), M.radiator, -0.23 - k * 0.05, 0, -0.2));
    g.position.set(-b * 0.22, -bh * 0.22, face);
    add('irspec', g);
  }
  if (I.includes('neutron')) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 20), M.foil);
    c.rotation.x = Math.PI / 2;
    c.position.z = -0.2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 20), M.metal);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = -0.42;
    g.add(c, cap);
    g.position.set(b * 0.3, -bh * 0.3, face);
    add('neutron', g);
  }
  if (I.includes('sounder')) {
    // Dipole: two 5 m fibreglass rods from a small feed box.
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.24, 0.12, 0.12), M.foilSilver));
    [-1, 1].forEach((s) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 5, 6), M.white);
      r.rotation.z = Math.PI / 2;
      r.position.x = s * 2.6;
      g.add(r);
      g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), M.metal, s * 5.1, 0, 0));
    });
    g.position.set(0, -bh * 0.45, face - 0.08);
    add('sounder', g);
  }
  if (I.includes('iceRadar')) {
    // Two long panel antennas folded out along the solar wings' axis.
    const g = new THREE.Group();
    [-1, 1].forEach((s) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, 0.35), [M.white, M.white, M.sar, M.white, M.white, M.white]);
      bar.position.set(s * (b / 2 + 3.4), 0.12, 0);
      g.add(bar);
      for (let k = 1; k < 4; k++) g.add(mesh(new THREE.BoxGeometry(0.03, 0.07, 0.37), M.frame, s * (b / 2 + 0.4 + k * 1.5), 0.12, 0));
      g.add(rod(new THREE.Vector3((s * b) / 2, 0, 0), new THREE.Vector3(s * (b / 2 + 0.42), 0.12, 0), 0.03, M.metal));
    });
    g.position.y = -0.15;
    add('iceRadar', g);
  }
  if (I.includes('sar')) {
    const g = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 0.1), [M.white, M.white, M.white, M.white, M.panelBack, M.sar]);
    panel.position.set(0, -bh * 0.05, face - 0.35);
    g.add(panel);
    for (let k = -1; k <= 1; k += 2) g.add(mesh(new THREE.BoxGeometry(0.03, 1.32, 0.12), M.frame, k * 1.05, -bh * 0.05, face - 0.35));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), M.metal, 0, 0, face - 0.15));
    add('sar', g);
  }
  if (I.includes('mag')) {
    // Boom with two magnetometers (one halfway, one at the tip) to sort the
    // spacecraft's own field from the planet's.
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 5, 6), M.metal, 0, 2.5, 0));
    for (let k = 1; k < 5; k++) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), M.frame, 0, k, 0));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), M.foil, 0, 2.6, 0));
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), M.foil, 0, 5, 0));
    g.rotation.x = Math.PI * 0.62;
    g.position.set(0, -bh * 0.2, b / 2);
    add('mag', g);
  }
  if (I.includes('uso')) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), M.foilSilver);
    box.position.set(b / 2 + 0.08, bh * 0.35, 0);
    add('uso', box);
  }
  for (let k = 0; k < (design.rtg || 0); k++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.1, 16), M.rtg));
    for (let fi = 0; fi < 6; fi++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.02), M.rtg);
      fin.rotation.y = (fi / 6) * Math.PI;
      g.add(fin);
    }
    [-1, 1].forEach((s) => g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16), M.frame, 0, s * 0.56, 0)));
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), M.metal);
    strut.rotation.x = Math.PI / 2;
    strut.position.z = -0.55;
    g.add(strut);
    const a = ((k - ((design.rtg || 1) - 1) / 2) * Math.PI) / 4;
    g.position.set(Math.sin(a) * 0.9, -bh * 0.25, b / 2 + 1.1);
    g.rotation.x = 0.35;
    add(`rtg${k}`, g);
  }

  root.userData.parts = parts;
  root.userData.size = Math.max(root.userData.span, D, bh + rt * 2 + 1.2);
  return root;
}

// Fold or unfold solar wings and the dish (0 = stowed, 1 = deployed).
export function setDeploy(craft, k, stuck) {
  const p = craft.userData.parts;
  if (craft.userData.crew) {
    [0, 1, 2, 3].forEach((i) => p['wing' + i] && (p['wing' + i].children[0].scale.x = 0.08 + 0.92 * k));
    return;
  }
  ['arrayL', 'arrayR'].forEach((key) => {
    const w = p[key];
    if (!w) return;
    const kk = stuck === key ? Math.min(k, 0.45) : k;
    w.scale.x = 0.08 + 0.92 * kk;
  });
  if (p.dish) {
    const kk = stuck === 'dish' ? Math.min(k, 0.3) : k;
    p.dish.scale.set(0.25 + 0.75 * kk, 1, 0.25 + 0.75 * kk);
  }
}
