// Eye-level world for the third/first-person views (docs/TEAM.md): a real sky
// dome with the Sun, Earth or Jupiter in their true directions, cliffs that
// hide the edge of the map, far ridges for depth, and ground clutter that keeps
// the near ground from looking empty at two metres. Nothing here touches the
// 2D sim. Only built when someone plays from eye level.
import { THREE } from '../3d/engine.js';
import { fbm } from '../3d/assets.js';
import { LOG_V_PARS, LOG_V, LOG_F_PARS, LOG_F, lampify, quality, gritRock } from './surface3d-fx.js';
import { rng } from './surface3d-world.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const DEG = Math.PI / 180;

// Where things hang in the sky, and what stands on the horizon.
const LOOK = {
  moon: {
    planet: { tex: 'earth-day', elev: 27, az: -102, r: 7.5, atm: [0.25, 0.5, 1.0], gain: 1.3, sun: [0.75, 0.25, 0.62] },
    sunSize: 0.012,
    cliff: { h: [12, 26], rough: 1.0, color: [0.2, 0.195, 0.19], color2: [0.42, 0.41, 0.39] },
    far: { h: [40, 120], color: [0.1, 0.098, 0.095], color2: [0.03, 0.03, 0.03] },
    clutter: [0.36, 0.35, 0.33],
  },
  mars: {
    planet: null,
    sunSize: 0.02,
    cliff: { h: [14, 30], rough: 1.0, color: [0.3, 0.13, 0.06], color2: [0.55, 0.26, 0.12] },
    far: { h: [50, 150], color: [0.58, 0.34, 0.19], color2: [0.42, 0.23, 0.13] },
    clutter: [0.3, 0.14, 0.07],
  },
  venus: {
    planet: null,
    sunSize: 0.05,
    cliff: null,
    far: { h: [24, 80], color: [0.95, 0.56, 0.18], color2: [0.7, 0.36, 0.1], below: true },
    clutter: null,
  },
  europa: {
    planet: { tex: 'jupiter', elev: 25, az: -82, r: 22, atm: [0.9, 0.7, 0.45], gain: 1.15, sun: [-0.55, 0.3, 0.78] },
    sunSize: 0.008,
    cliff: { h: [9, 20], rough: 1.5, color: [0.55, 0.66, 0.78], color2: [0.8, 0.9, 1.0] },
    far: { h: [30, 90], color: [0.2, 0.3, 0.44], color2: [0.08, 0.13, 0.22] },
    clutter: [0.72, 0.82, 0.94],
  },
};

// ---------- Sky dome ----------
function buildDome(worldId, cfg, grit) {
  const L = LOOK[worldId] || LOOK.moon;
  const s = cfg.sky;
  const p = L.planet;
  const planetDir = new THREE.Vector3();
  const pRight = new THREE.Vector3();
  const pUp = new THREE.Vector3();
  if (p) {
    const el = p.elev * DEG;
    const az = p.az * DEG;
    planetDir.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    pRight.crossVectors(new THREE.Vector3(0, 1, 0), planetDir).normalize();
    pUp.crossVectors(planetDir, pRight).normalize();
  }
  const uniforms = {
    uZenith: { value: new THREE.Vector3(...s.zenith) },
    uHorizon: { value: new THREE.Vector3(...s.horizon) },
    uNZenith: { value: new THREE.Vector3(...s.nightZenith) },
    uNHorizon: { value: new THREE.Vector3(...s.nightHorizon) },
    uNight: { value: 0 },
    uStorm: { value: 0 },
    uStars: { value: s.stars || 0 },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(...cfg.sun.dir).normalize() },
    uSunSize: { value: L.sunSize },
    uHazy: { value: cfg.sunDisc && cfg.sunDisc.hazy ? 1 : 0 },
    uBlueHalo: { value: worldId === 'mars' ? 1 : 0 },
    uPlanetOn: { value: 0 },
    uPlanetTex: { value: null },
    uPDir: { value: planetDir },
    uPRight: { value: pRight },
    uPUp: { value: pUp },
    uPTan: { value: p ? Math.tan(p.r * DEG) : 0.1 },
    uPSun: { value: new THREE.Vector3(...(p ? p.sun : [0, 0, 1])).normalize() },
    uPAtm: { value: new THREE.Vector3(...(p ? p.atm : [0, 0, 0])) },
    uPGain: { value: p ? p.gain : 1 },
    uClouds: { value: s.clouds || 0 },
    uDetail: { value: grit },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      uniform vec3 uZenith, uHorizon, uNZenith, uNHorizon, uSunDir, uPDir, uPRight, uPUp, uPSun, uPAtm;
      uniform float uNight, uStorm, uStars, uTime, uSunSize, uHazy, uBlueHalo, uPlanetOn, uPTan, uPGain, uClouds;
      uniform sampler2D uPlanetTex, uDetail;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main() {
        ${LOG_F}
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 zen = mix(uZenith, uNZenith, uNight);
        vec3 hor = mix(uHorizon, uNHorizon, uNight);
        vec3 col = mix(hor, zen, pow(up, 0.55));
        float dayK = 1.0 - uNight;

        if (uStars > 0.0) {
          vec3 sp = d * 150.0;
          vec3 cell = floor(sp);
          float h = hash(cell);
          if (h > 0.985) {
            vec3 f = fract(sp) - 0.5;
            float tw = 0.75 + 0.25 * sin(uTime * (1.5 + h * 5.0) + h * 40.0);
            float b = 1.0 - smoothstep(0.03, 0.2, length(f));
            col += vec3(0.95, 0.97, 1.1) * b * uStars * tw * (h - 0.985) * 66.0 * (1.0 - uStorm * 0.8);
          }
        }

        // The Sun, where the shadows say it is.
        float sd = dot(d, uSunDir);
        if (sd > 0.0) {
          float ang = sqrt(max(0.0, 2.0 * (1.0 - sd)));
          float disc = 1.0 - smoothstep(uSunSize * 0.86, uSunSize, ang);
          float glow = exp(-ang * (uHazy > 0.5 ? 3.0 : 7.0));
          vec3 halo = uBlueHalo > 0.5 ? vec3(0.42, 0.62, 0.95) : uHazy > 0.5 ? vec3(1.2, 0.72, 0.28) : vec3(1.0, 0.95, 0.85);
          float amt = uHazy > 0.5 ? 0.7 : uBlueHalo > 0.5 ? 0.4 : 0.22;
          col += halo * glow * amt * dayK;
          if (uHazy < 0.5) col = mix(col, vec3(14.0, 13.0, 11.0), disc * dayK);
          else col = mix(col, vec3(2.2, 1.7, 1.0), disc * dayK * 0.5);
        }

        // Earth or Jupiter on a shaded sphere.
        if (uPlanetOn > 0.5) {
          float z = dot(d, uPDir);
          if (z > 0.0) {
            vec2 q = vec2(dot(d, uPRight), dot(d, uPUp)) / z / uPTan;
            float r2 = dot(q, q);
            if (r2 < 1.0) {
              vec3 n = vec3(q, sqrt(1.0 - r2));
              float lit = max(0.0, dot(n, uPSun));
              vec2 ll = vec2(atan(n.x, n.z) / 6.2831853 + 0.5 + uTime * 0.002, asin(clamp(n.y, -1.0, 1.0)) / 3.14159265 + 0.5);
              vec3 tex = texture2D(uPlanetTex, ll, -1.0).rgb;
              vec3 c = tex * uPGain * (0.03 + 1.25 * lit);
              c += uPAtm * pow(1.0 - n.z, 3.0) * 0.9 * (0.3 + lit);
              col = mix(col, c, 1.0 - smoothstep(0.985, 1.0, r2));
            } else {
              float h = sqrt(r2) - 1.0;
              col += uPAtm * exp(-h * 12.0) * 0.28;
            }
          }
        }

        // Venus: cloud walls all around.
        if (uClouds > 0.5) {
          float az = atan(d.z, d.x);
          float a = texture2D(uDetail, vec2(az * 0.6 + uTime * 0.003, d.y * 1.4 + uTime * 0.0012)).r;
          float b = texture2D(uDetail, vec2(az * 1.7 - uTime * 0.007, d.y * 3.0)).r;
          float n = a * 0.7 + b * 0.35;
          float wall = smoothstep(0.42, 0.78, n) * (1.0 - smoothstep(0.0, 0.6, abs(d.y)));
          col = mix(col, vec3(1.0, 0.56, 0.17), wall * 0.55);
        }

        // Below the horizon the dome is the far ground's colour, so no seam shows.
        col = mix(col, hor * 0.55, smoothstep(0.0, -0.08, d.y) * step(uClouds, 0.5));
        col = mix(col, hor * 1.2, uStorm * 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 40, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.noAO = true;
  if (p && SMD.assets) {
    SMD.assets
      .texture(p.tex)
      .then((t) => {
        uniforms.uPlanetTex.value = t;
        uniforms.uPlanetOn.value = 1;
      })
      .catch(() => {});
  }
  return {
    mesh,
    update(t, night, storm, cam) {
      uniforms.uTime.value = t;
      uniforms.uNight.value = night;
      uniforms.uStorm.value = storm;
      mesh.position.copy(cam.position);
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

// ---------- Cliffs: the edge of the map is a wall of rock ----------
function buildCliffs(L, cfg, map, seed, height, grit, lamps) {
  const C = L.cliff;
  if (!C) return null;
  const S = map.size;
  const R = rng(seed + 91);
  // Walk around the map's rectangle, just outside it.
  const pts = [];
  const step = 3;
  const out = 1.5;
  for (let x = -out; x <= S + out; x += step) pts.push([x, -out]);
  for (let z = -out + step; z <= S + out; z += step) pts.push([S + out, z]);
  for (let x = S + out - step; x >= -out; x -= step) pts.push([x, S + out]);
  for (let z = S + out - step; z > -out; z -= step) pts.push([-out, z]);
  const n = pts.length;
  const rows = 10;
  const pos = [];
  const col = [];
  const idx = [];
  const lo = new THREE.Color(...C.color);
  const hi = new THREE.Color(...C.color2);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    // Outward direction at this point.
    const ox = x <= 0 ? -1 : x >= S ? 1 : 0;
    const oz = z <= 0 ? -1 : z >= S ? 1 : 0;
    const crest = C.h[0] + (C.h[1] - C.h[0]) * fbm(i * 0.05, 7, seed * 0.01, 3, 41);
    const base = height(x, z);
    for (let j = 0; j < rows; j++) {
      const u = j / (rows - 1);
      // A slope that steepens, with ledges, and a jagged crest.
      const prof = Math.pow(u, 0.75);
      const jag = (fbm(i * 0.21, j * 0.9, 3.1, 2, 59) - 0.5) * 2.2 * C.rough;
      const lean = u * (6 + crest * 0.35) + jag * 0.5;
      const y = base - 1.5 + prof * (crest + (j >= rows - 2 ? (R() - 0.5) * 1.6 * C.rough : 0));
      pos.push(x + ox * lean + (oz ? jag * 0.3 : 0), y, z + oz * lean + (ox ? jag * 0.3 : 0));
      const shade = 0.45 + 0.55 * fbm(i * 0.3, j * 1.3, 11, 2, 7);
      c.copy(lo).lerp(hi, clamp(shade * (0.5 + u * 0.7)));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i;
    const b = (i + 1) % n;
    for (let j = 0; j < rows - 1; j++) {
      const p0 = a * rows + j;
      const p1 = b * rows + j;
      const p2 = a * rows + j + 1;
      const p3 = b * rows + j + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  const g = geo.toNonIndexed();
  geo.dispose();
  g.computeVertexNormals();
  const mat = lampify(gritRock(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, flatShading: true, side: THREE.DoubleSide, emissive: new THREE.Color(C.color[0] * 0.09, C.color[1] * 0.09, C.color[2] * 0.09) }), grit, 0.8), lamps);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- Far ridges: depth past the cliffs ----------
function buildRidges(L, map, seed) {
  const F = L.far;
  const mid = map.size / 2;
  const layers = [
    { r: 520, seg: 160, k: 1, seedA: 3 },
    { r: 880, seg: 120, k: 1.5, seedA: 9 },
  ];
  const pos = [];
  const col = [];
  const idx = [];
  const lo = new THREE.Color(...F.color);
  const hi = new THREE.Color(...F.color2);
  const c = new THREE.Color();
  let base = 0;
  layers.forEach((L2, li) => {
    for (let i = 0; i <= L2.seg; i++) {
      const a = (i / L2.seg) * Math.PI * 2;
      const n = fbm(Math.cos(a) * 3 + L2.seedA, Math.sin(a) * 3, seed * 0.01, 4, 77 + li);
      const peak = F.h[0] + (F.h[1] - F.h[0]) * Math.pow(n, 1.4) * 1.9 * L2.k;
      const x = mid + Math.cos(a) * L2.r;
      const z = mid + Math.sin(a) * L2.r;
      pos.push(x, F.below ? -60 : -6, z);
      pos.push(x + Math.cos(a) * 20, peak, z + Math.sin(a) * 20);
      const k = 0.15 + n * 0.85;
      c.copy(lo).lerp(hi, li ? 0.8 : 0.3);
      col.push(c.r * 0.55, c.g * 0.55, c.b * 0.55, c.r * k, c.g * k, c.b * k);
    }
    for (let i = 0; i < L2.seg; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    base += (L2.seg + 1) * 2;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  return mesh;
}

// ---------- Pebbles around your feet ----------
function buildClutter(L, height, map, lamps, low) {
  if (!L.clutter) return null;
  const CELL = 1.4;
  const R = low ? 14 : 22; // cells
  const cap = (R * 2 + 1) * (R * 2 + 1);
  const g = new THREE.IcosahedronGeometry(1, 0);
  const mat = lampify(new THREE.MeshStandardMaterial({ color: new THREE.Color(...L.clutter), roughness: 0.95, flatShading: true }), lamps);
  const mesh = new THREE.InstancedMesh(g, mat, cap);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  let lastI = 1e9;
  let lastJ = 1e9;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const H = (i, j, s) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return {
    mesh,
    update(x, z) {
      const ci = Math.floor(x / CELL);
      const cj = Math.floor(z / CELL);
      if (ci === lastI && cj === lastJ) return;
      lastI = ci;
      lastJ = cj;
      let n = 0;
      for (let dj = -R; dj <= R; dj++) {
        for (let di = -R; di <= R; di++) {
          const i = ci + di;
          const j = cj + dj;
          const h = H(i, j, 1);
          if (h < 0.45) continue;
          const px = (i + H(i, j, 2)) * CELL;
          const pz = (j + H(i, j, 3)) * CELL;
          const big = h > 0.97;
          const s = big ? 0.14 + H(i, j, 4) * 0.2 : 0.02 + H(i, j, 4) * H(i, j, 5) * 0.09;
          pos.set(px, height(px, pz) + s * 0.25, pz);
          e.set(H(i, j, 6) * 3, H(i, j, 7) * 6, H(i, j, 8) * 3);
          q.setFromEuler(e);
          sc.set(s * (0.8 + H(i, j, 9) * 0.7), s * 0.6, s);
          m4.compose(pos, q, sc);
          mesh.setMatrixAt(n++, m4);
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      g.dispose();
      mat.dispose();
    },
  };
}

// ---------- All of it ----------
export function buildHorizon({ scene, worldId, cfg, map, seed, height, grit, lamps }) {
  const L = LOOK[worldId] || LOOK.moon;
  const low = quality().tier === 'low';
  const dome = buildDome(worldId, cfg, grit);
  scene.add(dome.mesh);
  const cliffs = buildCliffs(L, cfg, map, seed || 1, height, grit, lamps);
  if (cliffs) scene.add(cliffs);
  const ridges = buildRidges(L, map, seed || 1);
  scene.add(ridges);
  const clutter = buildClutter(L, height, map, lamps, low);
  if (clutter) scene.add(clutter.mesh);
  const parts = [dome.mesh, ridges];
  if (cliffs) parts.push(cliffs);
  if (clutter) parts.push(clutter.mesh);
  const api = {
    setVisible(on) {
      parts.forEach((m) => (m.visible = on));
    },
    update(t, night, storm, cam, focusX, focusZ) {
      dome.update(t, night, storm, cam);
      if (clutter) clutter.update(focusX, focusZ);
    },
    dispose() {
      dome.dispose();
      if (clutter) clutter.dispose();
    },
  };
  return api;
}
