// Solar system map: real planet positions (JPL mean elements through
// SMD.physics), orbits, the agency's spacecraft on their real trajectories,
// and the transfer arc of an open launch window. 1 scene unit ~ 0.1 AU
// (compressed beyond Mars so Jupiter fits on a phone screen).
import { THREE, ease, getRenderer } from './engine.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { makeStars, makeSun, glowTexture, softDot, planetTexture } from './assets.js';

const SMD = globalThis.SMD;
const DAY_MS = 864e5;

// Look of each body. Radii are exaggerated (true scale would make Earth a
// speck 1/23,000 of its orbit). Textures: real NASA maps from assets/textures.
export const BODIES = {
  venus: { r: 0.3, color: 0xf0d68a, css: '#f4e08a', tilt: 177.4, ids: ['venus', 'venusRadar', 'venus_magellan_radar'], file: 'assets/textures/venus_magellan_radar_nasa3d_1440.jpg', glow: 0xf3d79a, proc: 'venus' },
  earth: { r: 0.32, color: 0x6fb6ff, css: '#6fb6ff', tilt: 23.4, ids: ['earth', 'earthDay', 'earth_bmng_july'], file: 'assets/textures/earth_bmng_july_4k.jpg', glow: 0x6fb6ff, proc: 'earth' },
  mars: { r: 0.24, color: 0xe8775a, css: '#f07a5a', tilt: 25.2, ids: ['mars', 'marsColor', 'mars_viking'], file: 'assets/textures/mars_viking_2k.jpg', glow: 0xe8a36f, proc: 'mars' },
  jupiter: { r: 0.85, color: 0xc9925f, css: '#d39a68', tilt: 3.1, ids: ['jupiter', 'jupiter_cassini'], file: 'assets/textures/jupiter_cassini_pia07782_3601.jpg', glow: 0xe8d8b8, proc: 'jupiter' },
  moon: { r: 0.085, color: 0xbdbdb8, css: '#c9c9c4', tilt: 6.7, ids: ['moon', 'moonColor', 'moon_lroc'], file: 'assets/textures/moon_lroc_color_2k.jpg', glow: null, proc: null },
};
const PLANETS = ['venus', 'earth', 'mars', 'jupiter'];
const MOON_DIST = 0.72; // scene units from Earth (exaggerated)

// Shared across visits so reopening the map is instant.
const texCache = {};
function bodyTexture(key) {
  if (texCache[key]) return texCache[key];
  const b = BODIES[key];
  const fromAssets = (i) => {
    if (!SMD.assets || !SMD.assets.texture || i >= b.ids.length) return Promise.reject(new Error('no asset'));
    return Promise.resolve()
      .then(() => SMD.assets.texture(b.ids[i], { lo: true }))
      .catch(() => fromAssets(i + 1));
  };
  const fromFile = () =>
    new Promise((res, rej) => {
      new THREE.TextureLoader().load(
        b.file,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 4;
          res(t);
        },
        undefined,
        rej
      );
    });
  texCache[key] = fromAssets(0)
    .catch(fromFile)
    .then((t) => {
      if (t && t.userData) t.userData.keep = true; // shared: never disposed by a scene
      return t;
    })
    .catch(() => (b.proc ? planetTexture(b.proc, 512) : null));
  return texCache[key];
}

function textSprite(text, color = 'rgba(169,182,194,0.7)') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '600 34px Archivo, "Noto Kufi Arabic", "Arial Narrow", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(2, 0.5, 1);
  return s;
}

function circlePoints(radius, n = 256) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, -Math.sin(a) * radius));
  }
  return pts;
}

// opts: { nowMs, names: {venus, earth, moon, mars, jupiter}, labelLayer, onPick(sel), trueScale }
export function createSolarMap(opts = {}) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const AU = SMD.physics.AU;
  let trueScale = !!opts.trueScale;
  // Distance in AU -> scene units. Compressed: close to true inside Mars,
  // squeezed beyond so Jupiter's orbit stays on screen.
  const f = (au) => (trueScale ? 10 * au : (12 * au) / (1 + au / 4));
  const toScene = (rKm, out = new THREE.Vector3()) => {
    const au = Math.hypot(rKm[0], rKm[1]) / AU;
    const k = au > 0 ? f(au) / au / AU : 0;
    return out.set(rKm[0] * k, 0, -rKm[1] * k);
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060c);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 6000);
  camera.position.set(0, 30, 26);

  scene.add(makeStars(4500, 2500, 11));
  // A faint band of brighter stars along the ecliptic, like the zodiacal glow.
  const band = makeStars(1400, 2400, 29);
  band.geometry.attributes.position.array.forEach((v, i, arr) => {
    if (i % 3 === 1) arr[i] = v * 0.12;
  });
  band.material.size = 1.2;
  band.material.transparent = true;
  band.material.opacity = 0.55;
  scene.add(band);

  // Sun: lights the planets from the middle so their phases are real.
  const sunLight = new THREE.PointLight(0xfff4e2, 3.2, 0, 0);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x8a9cb2, 0.3));
  // A soft light from the camera side so planets between you and the Sun still read.
  const camFill = new THREE.DirectionalLight(0xbfd3ea, 0.85);
  camera.add(camFill);
  camFill.position.set(0, 0, 1);
  scene.add(camera);
  const sun = makeSun(3.6);
  scene.add(sun);
  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
  scene.add(sunCore);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xf0b429, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
  corona.scale.setScalar(16);
  scene.add(corona);

  // ---------- Grid and orbits ----------
  const gridGroup = new THREE.Group();
  scene.add(gridGroup);
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);
  const orbitLines = {};
  function buildGrid() {
    [gridGroup, orbitGroup].forEach((g) => {
      g.children.slice().forEach((c) => {
        g.remove(c);
        c.geometry && c.geometry.dispose();
        if (c.material) {
          if (c.material.map) c.material.map.dispose();
          c.material.dispose();
        }
      });
    });
    const gridMat = new THREE.LineBasicMaterial({ color: 0x6f8090, transparent: true, opacity: 0.13, depthWrite: false });
    for (let au = 0.5; au <= 5.5; au += 0.5) {
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePoints(f(au), 192)), gridMat.clone());
      if (au % 1) line.material.opacity = 0.06;
      gridGroup.add(line);
      if (!(au % 1) && au >= 2) {
        const s = textSprite(`${au} AU`);
        s.position.set(f(au) * Math.cos(-0.5), 0.02, -f(au) * Math.sin(-0.5));
        s.scale.multiplyScalar(trueScale ? 1.6 : 1);
        gridGroup.add(s);
      }
    }
    // Spokes every 30 degrees: the plotting table.
    const spokes = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      spokes.push(new THREE.Vector3(Math.cos(a) * f(0.35), 0, -Math.sin(a) * f(0.35)), new THREE.Vector3(Math.cos(a) * f(5.6), 0, -Math.sin(a) * f(5.6)));
    }
    gridGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), new THREE.LineBasicMaterial({ color: 0x6f8090, transparent: true, opacity: 0.05, depthWrite: false })));
    // Main asteroid belt, 2.1 to 3.3 AU.
    const n = 2600;
    const belt = new Float32Array(n * 3);
    let seed = 1234567;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < n; i++) {
      const au = 2.1 + Math.pow(rnd(), 0.8) * 1.2;
      const a = rnd() * Math.PI * 2;
      const r = f(au);
      belt.set([Math.cos(a) * r, (rnd() - 0.5) * 0.25 * (r / 20), -Math.sin(a) * r], i * 3);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(belt, 3));
    gridGroup.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x9a8f80, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false })));
    PLANETS.forEach((k) => {
      const a = SMD.physics.PLANETS[k].a;
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePoints(f(a), 320)), new THREE.LineBasicMaterial({ color: BODIES[k].color, transparent: true, opacity: 0.38, depthWrite: false }));
      orbitGroup.add(line);
      orbitLines[k] = line;
    });
  }
  buildGrid();

  // ---------- Bodies ----------
  const bodies = {};
  const hitMeshes = [];
  const glowMap = glowTexture();
  function makeBody(key) {
    const b = BODIES[key];
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.92, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.r, 64, 32), mat);
    const spin = new THREE.Group();
    spin.rotation.z = THREE.MathUtils.degToRad(b.tilt);
    spin.add(mesh);
    g.add(spin);
    if (b.glow) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: b.glow, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(b.r * 2.75);
      g.add(glow);
    }
    // A bigger invisible sphere so small planets are easy to tap.
    const hit = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.55, b.r * 1.8), 12, 8), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.userData.pick = { type: 'planet', key };
    g.add(hit);
    hitMeshes.push(hit);
    scene.add(g);
    bodyTexture(key).then((t) => {
      if (!t || disposed) return;
      mat.map = t;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    });
    bodies[key] = { group: g, mesh, spin };
  }
  let disposed = false;
  PLANETS.concat('moon').forEach(makeBody);
  bodies.moon.spin.rotation.y = 0;

  // Selection ring around the picked body.
  const selRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePoints(1, 96)), new THREE.LineBasicMaterial({ color: 0xd9a21b, transparent: true, opacity: 0.95, depthWrite: false }));
  selRing.visible = false;
  scene.add(selRing);

  // ---------- Spacecraft tracks ----------
  const trackGroup = new THREE.Group();
  scene.add(trackGroup);
  let tracks = []; // {id, name, launch, kind, path?, flown?, marker, samples}
  const GOLD = 0xd9a21b;

  function clearGroup(g) {
    g.children.slice().forEach((c) => {
      g.remove(c);
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    });
  }

  function makeMarker(color) {
    const m = new THREE.Group();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.62);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), new THREE.MeshBasicMaterial({ color: 0xfff3cf }));
    m.add(halo, core);
    m.userData.halo = halo;
    m.userData.core = core;
    return m;
  }

  function samplePath(launch, n = 260) {
    const pts = [];
    const t0 = launch.departMs;
    const t1 = launch.arriveMs;
    for (let i = 0; i <= n; i++) pts.push(toScene(SMD.ops.probePosition(launch, t0 + ((t1 - t0) * i) / n)));
    return pts;
  }

  function buildTracks() {
    clearGroup(trackGroup);
    tracks.forEach((tr) => {
      const kind = SMD.data.MISSIONS[tr.missionKey].kind;
      tr.kind = kind;
      tr.dest = SMD.data.MISSIONS[tr.missionKey].dest;
      tr.marker = makeMarker(GOLD);
      trackGroup.add(tr.marker);
      tr.path = null;
      if (kind === 'planet' && tr.launch) {
        try {
          tr.samples = samplePath(tr.launch);
        } catch (e) {
          tr.samples = null;
        }
        if (tr.samples) {
          const geo = new THREE.BufferGeometry().setFromPoints(tr.samples);
          const planned = tr.status !== 'flying';
          const mat = planned
            ? new THREE.LineDashedMaterial({ color: GOLD, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.75, depthWrite: false })
            : new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.35, depthWrite: false });
          const line = new THREE.Line(geo, mat);
          if (planned) line.computeLineDistances();
          trackGroup.add(line);
          const flown = new THREE.Line(geo.clone(), new THREE.LineBasicMaterial({ color: 0xf6d27a, transparent: true, opacity: 1, depthWrite: false }));
          flown.geometry.setDrawRange(0, 0);
          trackGroup.add(flown);
          tr.path = line;
          tr.flown = flown;
        }
      }
    });
  }

  // ---------- Launch-window arc ----------
  const arcGroup = new THREE.Group();
  scene.add(arcGroup);
  let arc = null; // { key, launch, label }
  const TEAL = 0x3fc1b4;
  function buildArc() {
    clearGroup(arcGroup);
    if (!arc) return;
    try {
      const pts = samplePath(arc.launch, 220).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
      if (pts.length < 2) {
        arc = null;
        return;
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: TEAL, dashSize: 0.08, gapSize: 0.1, transparent: true, opacity: 0.95, depthWrite: false }));
      line.computeLineDistances();
      arcGroup.add(line);
      // A string of soft beads so the path reads from far away, and a pulse that runs along it.
      const beads = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(pts.filter((_, i) => i % 3 === 0)),
        new THREE.PointsMaterial({ map: softDot(), color: TEAL, size: 0.16, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      arcGroup.add(beads);
      const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xbaf5ee, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      pulse.scale.setScalar(0.55);
      arcGroup.add(pulse);
      arc.pts = pts;
      arc.pulse = pulse;
      // Where the planet will be when the spacecraft gets there.
      const ghost = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePoints(BODIES[arc.key].r * 1.9 + 0.12, 64)), new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.9, depthWrite: false }));
      ghost.position.copy(pts[pts.length - 1]);
      arcGroup.add(ghost);
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: TEAL, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      dot.scale.setScalar(BODIES[arc.key].r * 3);
      dot.position.copy(ghost.position);
      arcGroup.add(dot);
      arc.end = ghost.position.clone();
      arc.ghost = ghost;
    } catch (e) {
      arc.end = null;
    }
  }

  // ---------- HTML labels ----------
  const layer = opts.labelLayer || null;
  const labels = [];
  function addLabel(id, text, cls, pick, color) {
    if (!layer) return null;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `map-label ${cls}`;
    if (color) el.style.setProperty('--c', color);
    el.innerHTML = `<i aria-hidden="true"></i><span></span>`;
    el.querySelector('span').textContent = text;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pick && opts.onPick) opts.onPick(pick);
    });
    layer.appendChild(el);
    const l = { id, el, pos: new THREE.Vector3(), show: true, pick };
    labels.push(l);
    return l;
  }
  function removeLabels(prefix) {
    for (let i = labels.length - 1; i >= 0; i--) {
      if (labels[i].id.startsWith(prefix)) {
        labels[i].el.remove();
        labels.splice(i, 1);
      }
    }
  }
  const names = opts.names || {};
  PLANETS.concat('moon').forEach((k) => addLabel('p:' + k, names[k] || k, 'map-label--planet' + (k === 'moon' ? ' map-label--small' : ''), { type: 'planet', key: k }, BODIES[k].css));
  const sunLabel = addLabel('s:sun', names.sun || 'Sun', 'map-label--sun', { type: 'sun' }, '#f6d27a');

  // ---------- Time ----------
  let nowMs = opts.nowMs || Date.now();
  const tmp = new THREE.Vector3();
  function moonOffset(ms, out) {
    // Mean longitude of the Moon (J2000: 218.316 deg, 13.176396 deg/day).
    const d = (ms - Date.UTC(2000, 0, 1, 12)) / DAY_MS;
    const a = THREE.MathUtils.degToRad(218.316 + 13.176396 * d);
    return out.set(Math.cos(a) * MOON_DIST * bodyScale, 0, -Math.sin(a) * MOON_DIST * bodyScale);
  }

  function bodyPos(key, ms, out = new THREE.Vector3()) {
    if (key === 'moon') return bodyPos('earth', ms, out).add(moonOffset(ms, tmp));
    return toScene(SMD.physics.planetState(key, ms).r, out);
  }

  function craftPos(tr, ms, out) {
    const L = tr.launch;
    if (!L || ms < L.departMs) return null;
    const orbitAround = (key, radius, periodDays) => {
      bodyPos(key, ms, out);
      const a = (ms / DAY_MS / periodDays) * Math.PI * 2 + tr.id;
      return out.add(tmp.set(Math.cos(a) * radius, 0.02, -Math.sin(a) * radius));
    };
    if (tr.kind === 'earth') return orbitAround('earth', (BODIES.earth.r + 0.22) * bodyScale, 3);
    if (tr.kind === 'moon') {
      if (ms >= L.arriveMs) return orbitAround('moon', (BODIES.moon.r + 0.12) * bodyScale, 2);
      const k = (ms - L.departMs) / Math.max(1, L.arriveMs - L.departMs);
      const e = bodyPos('earth', ms, new THREE.Vector3());
      const m = bodyPos('moon', ms, new THREE.Vector3());
      return out.copy(e).lerp(m, k);
    }
    if (ms >= L.arriveMs) return orbitAround(tr.dest, (BODIES[tr.dest].r + 0.24) * bodyScale, 20);
    return toScene(SMD.ops.probePosition(L, ms), out);
  }

  // Bodies grow as the camera pulls back so they never shrink to a dot.
  let bodyScale = 1;
  function applyScale() {
    const d = camera.position.distanceTo(controls.target);
    const s = THREE.MathUtils.clamp(d / (trueScale ? 30 : 20), 1, trueScale ? 4 : 3.2);
    if (Math.abs(s - bodyScale) < 0.01) return;
    bodyScale = s;
    PLANETS.concat('moon').forEach((k) => bodies[k].group.scale.setScalar(k === 'jupiter' ? 1 + (s - 1) * 0.6 : s));
    applyTime();
  }

  function applyTime() {
    PLANETS.concat('moon').forEach((k) => bodyPos(k, nowMs, bodies[k].group.position));
    tracks.forEach((tr) => {
      const p = craftPos(tr, nowMs, tr.marker.position);
      tr.visible = !!p;
      tr.marker.visible = !!p;
      if (tr.flown && tr.launch) {
        const k = THREE.MathUtils.clamp((nowMs - tr.launch.departMs) / (tr.launch.arriveMs - tr.launch.departMs), 0, 1);
        tr.flown.geometry.setDrawRange(0, Math.round(k * (tr.samples.length - 1)) + 1);
        tr.flown.visible = k > 0;
      }
    });
  }

  // ---------- Camera ----------
  const renderer = getRenderer();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.9;
  controls.maxDistance = 220;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.9;
  controls.target.set(0, 0, 0);
  let aspect = 1;
  let vw = 1;
  let vh = 1;
  let fly = null; // camera tween
  let follow = null; // key or track id the camera follows
  const lastFollow = new THREE.Vector3();

  function framing(radius) {
    // Distance that keeps a disc of this radius on screen at a 55 degree tilt.
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const fit = radius / Math.tan(fov / 2) / Math.min(1, aspect * 0.92);
    return fit * 1.0;
  }
  function flyTo(target, dist, elev = 0.95, azimuth) {
    const dir = camera.position.clone().sub(controls.target);
    const az = azimuth !== undefined ? azimuth : Math.atan2(dir.x, dir.z);
    const toPos = new THREE.Vector3(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist).add(target);
    if (reduced) {
      controls.target.copy(target);
      camera.position.copy(toPos);
      fly = null;
      return;
    }
    fly = { t: 0, dur: 1.1, fromPos: camera.position.clone(), toPos, fromT: controls.target.clone(), toT: target.clone() };
  }
  function view(preset) {
    follow = null;
    const r = preset === 'inner' ? f(1.75) : f(5.45);
    flyTo(new THREE.Vector3(), framing(r), preset === 'inner' ? 1.0 : 0.9, preset === 'all' ? 0 : undefined);
  }
  function focus(sel) {
    if (!sel) return;
    let pos = null;
    let dist = 4;
    if (sel.type === 'planet') {
      pos = bodies[sel.key].group.position.clone();
      dist = sel.key === 'jupiter' ? 7 : sel.key === 'moon' || sel.key === 'earth' ? 3.2 : 3.6;
      follow = { type: 'planet', key: sel.key };
    } else if (sel.type === 'craft') {
      const tr = tracks.find((x) => x.id === sel.id);
      if (!tr || !tr.visible) return;
      pos = tr.marker.position.clone();
      dist = 3.4;
      follow = { type: 'craft', id: sel.id };
    } else if (sel.type === 'sun') {
      pos = new THREE.Vector3();
      dist = framing(f(1.2));
      follow = null;
    }
    if (pos) {
      lastFollow.copy(pos);
      // Look from the Sun side, a little off, so the day side and the terminator both show.
      const az = pos.lengthSq() > 0.01 ? Math.atan2(-pos.x, -pos.z) + 0.65 : undefined;
      flyTo(pos, dist * (aspect < 1 ? 1.7 : 1), 0.6, az);
    }
  }
  function followPos() {
    if (!follow) return null;
    if (follow.type === 'planet') return bodies[follow.key].group.position;
    const tr = tracks.find((x) => x.id === follow.id);
    return tr && tr.visible ? tr.marker.position : null;
  }

  // ---------- Picking ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const canvas = renderer.domElement;
  function pickAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hitMeshes, false);
    return hits.length ? hits[0].object.userData.pick : null;
  }
  const onDown = (e) => (down = { x: e.clientX, y: e.clientY });
  const onUp = (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    const p = pickAt(e);
    if (p && opts.onPick) opts.onPick(p);
  };
  const onMove = (e) => {
    if (e.pointerType !== 'mouse' || down) return;
    canvas.style.cursor = pickAt(e) ? 'pointer' : 'grab';
  };
  // A user drag ends any camera tween (but not the follow).
  const onStart = () => (fly = null);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointermove', onMove);
  controls.addEventListener('start', onStart);
  canvas.setAttribute('aria-hidden', 'true');

  // ---------- Selection ----------
  let selected = null;
  function select(sel, doFocus = true) {
    selected = sel;
    PLANETS.forEach((k) => (orbitLines[k].material.opacity = sel && sel.type === 'planet' && sel.key === k ? 0.9 : 0.38));
    labels.forEach((l) => l.el.classList.toggle('is-selected', !!(sel && l.pick && l.pick.type === sel.type && (l.pick.key === sel.key || l.pick.id === sel.id) && sel.type !== 'sun')));
    if (sunLabel) sunLabel.el.classList.toggle('is-selected', !!(sel && sel.type === 'sun'));
    if (doFocus) focus(sel);
    else follow = null;
  }

  // ---------- Frame ----------
  let time = 0;
  function update(dt) {
    time += dt;
    if (fly) {
      fly.t += dt;
      const k = ease.inOut(Math.min(1, fly.t / fly.dur));
      // While following a moving body, aim at where it is now.
      const fp = followPos();
      const toT = fp ? fp : fly.toT;
      const offset = fly.toPos.clone().sub(fly.toT);
      controls.target.lerpVectors(fly.fromT, toT, k);
      camera.position.lerpVectors(fly.fromPos, toT.clone().add(offset), k);
      if (fly.t >= fly.dur) {
        fly = null;
        if (fp) lastFollow.copy(fp);
      }
    } else {
      const fp = followPos();
      if (fp) {
        const d = fp.clone().sub(lastFollow);
        controls.target.add(d);
        camera.position.add(d);
        lastFollow.copy(fp);
      }
    }
    controls.update();
    applyScale();
    if (!reduced) {
      PLANETS.concat('moon').forEach((k) => (bodies[k].mesh.rotation.y += dt * (k === 'jupiter' ? 0.35 : k === 'venus' ? -0.03 : 0.15)));
      corona.material.opacity = 0.11 + Math.sin(time * 0.7) * 0.02;
    }
    // Selection ring follows the picked body and pulses.
    const target = selected && selected.type === 'planet' ? bodies[selected.key].group.position : selected && selected.type === 'craft' ? (tracks.find((x) => x.id === selected.id) || {}).marker?.position : null;
    const trSel = selected && selected.type === 'craft' ? tracks.find((x) => x.id === selected.id) : null;
    selRing.visible = !!target && (!trSel || trSel.visible);
    if (selRing.visible) {
      selRing.position.copy(target);
      const base = selected.type === 'planet' ? (BODIES[selected.key].r * 1.55 + 0.1) * bodies[selected.key].group.scale.x : 0.32;
      selRing.scale.setScalar(base * (1 + (reduced ? 0 : Math.sin(time * 3) * 0.06)));
    }
    tracks.forEach((tr) => {
      if (!tr.marker.visible) return;
      const s = 1 + (reduced ? 0 : Math.sin(time * 4 + tr.id) * 0.15);
      tr.marker.userData.halo.scale.setScalar(0.62 * s);
      tr.marker.userData.core.rotation.y += dt * 1.5;
    });
    if (arc && arc.ghost && !reduced) arc.ghost.scale.setScalar(1 + Math.sin(time * 2.4) * 0.08);
    if (arc && arc.pulse && arc.pts && arc.pts.length) {
      const k = reduced ? 1 : (time * 0.35) % 1;
      const p = arc.pts[Math.floor(k * (arc.pts.length - 1))];
      if (p) arc.pulse.position.copy(p);
      arc.pulse.material.opacity = reduced ? 0 : Math.sin(k * Math.PI);
    }
    // Spacecraft markers keep a readable size at any zoom.
    const ms = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) / 16, 0.28, 2.2);
    tracks.forEach((tr) => tr.marker.scale.setScalar(ms));
    updateLabels();
  }

  const proj = new THREE.Vector3();
  const earthScreen = { x: 0, y: 0, ok: false };
  function screenOf(pos) {
    proj.copy(pos).project(camera);
    if (proj.z > 1 || proj.z < -1) return null;
    return { x: (proj.x * 0.5 + 0.5) * vw, y: (-proj.y * 0.5 + 0.5) * vh };
  }
  function updateLabels() {
    if (!layer) return;
    const e = screenOf(bodies.earth.group.position);
    earthScreen.ok = !!e;
    if (e) Object.assign(earthScreen, e);
    labels.forEach((l) => {
      let pos = null;
      let hidden = false;
      const [kind, id] = l.id.split(':');
      if (kind === 'p') pos = bodies[id].group.position;
      else if (kind === 's') pos = sun.position;
      else if (kind === 'c') {
        const tr = tracks.find((x) => 'c:' + x.id === l.id);
        pos = tr && tr.visible ? tr.marker.position : null;
      } else if (kind === 'a') pos = arc && arc.end;
      const s = pos ? screenOf(pos) : null;
      if (!s) hidden = true;
      // The Moon's label only shows once zoomed in far enough to separate it from Earth.
      if (s && id === 'moon' && earthScreen.ok && Math.hypot(s.x - earthScreen.x, s.y - earthScreen.y) < 48) hidden = true;
      if (s && (s.x < -40 || s.y < -20 || s.x > vw + 40 || s.y > vh + 20)) hidden = true;
      if (hidden) {
        if (l.show) {
          l.el.style.visibility = 'hidden';
          l.show = false;
        }
        return;
      }
      if (!l.show) {
        l.el.style.visibility = '';
        l.show = true;
      }
      // Planet labels sit just outside the disc, however close the camera is.
      let dx = 0;
      if (kind === 'p') {
        const r = BODIES[id].r * bodies[id].group.scale.x;
        const d = camera.position.distanceTo(pos);
        dx = Math.min(240, (r / (d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * (vh / 2));
      }
      l.el.style.transform = `translate(${(s.x + dx).toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    });
  }

  // Space covered by a bottom sheet: the view centre moves up to stay visible.
  let inset = 0;
  function applyInset() {
    if (inset > 0) camera.setViewOffset(vw, vh + inset, 0, inset, vw, vh);
    else camera.clearViewOffset();
  }
  function onResize(w, h) {
    const first = vw === 1;
    vw = w;
    vh = h;
    aspect = w / h;
    applyInset();
    if (first) {
      // First frame: start framed on the whole map, Earth toward the viewer.
      const r = f(5.45);
      const dist = framing(r);
      const elev = 0.9;
      camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }

  applyTime();

  return {
    scene,
    camera,
    exposure: 1.15,
    update,
    onResize,
    dispose() {
      disposed = true;
      controls.dispose();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.style.cursor = '';
      canvas.removeAttribute('aria-hidden');
      labels.forEach((l) => l.el.remove());
      labels.length = 0;
    },
    setTime(ms) {
      nowMs = ms;
      applyTime();
    },
    // list: [{ id, name, missionKey, status, launch }]
    setTracks(list) {
      removeLabels('c:');
      tracks = list.map((x) => ({ ...x }));
      buildTracks();
      tracks.forEach((tr) => addLabel('c:' + tr.id, tr.name, 'map-label--craft', { type: 'craft', id: tr.id }, '#f6d27a'));
      applyTime();
    },
    // a: { key, launch, label } or null
    setArc(a) {
      removeLabels('a:');
      arc = a ? { ...a } : null;
      buildArc();
      if (arc && arc.label) addLabel('a:' + arc.key, arc.label, 'map-label--ghost', { type: 'planet', key: arc.key }, '#3fc1b4');
    },
    setTrueScale(on) {
      trueScale = !!on;
      buildGrid();
      buildTracks();
      buildArc();
      applyTime();
      const fp = followPos();
      if (fp) lastFollow.copy(fp);
      view(selected && selected.type === 'planet' && selected.key !== 'jupiter' ? 'inner' : 'all');
    },
    setInset(px) {
      inset = Math.max(0, Math.round(px || 0));
      applyInset();
    },
    select,
    view,
    focus,
    craftPosition(id, ms) {
      const tr = tracks.find((x) => x.id === id);
      if (!tr || !tr.launch || ms < tr.launch.departMs) return null;
      // Heliocentric km, for distances shown in the panel.
      if (tr.kind === 'earth') return SMD.physics.planetState('earth', ms).r;
      if (tr.kind === 'moon') return SMD.physics.planetState('earth', ms).r;
      if (ms >= tr.launch.arriveMs) return SMD.physics.planetState(tr.dest, ms).r;
      return SMD.ops.probePosition(tr.launch, ms);
    },
  };
}
