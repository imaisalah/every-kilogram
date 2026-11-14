// Rigged human characters for Last Light (and every screen that uses
// createAstronaut): CC0 Quaternius "Universal Base Characters" bodies and
// the "Universal Animation Library" clips (see docs/CREDITS.md), loaded with
// GLTFLoader, cloned per character with SkeletonUtils and driven by an
// AnimationMixer plus a few procedural layers.
//
//   await preloadCharacters();            // or let createAstronaut swap in later
//   const ch = createRigged(appearance, { outfit: 'flight' });
//   scene.add(ch.group); ... ch.update(dt) every frame
//
// What is built here, once per body (male / female) and shared by clones:
//  - face morph targets made from the eye and lip positions (blink, smile,
//    frown, brows up / sad / angry, mouth open), so expressions and blinking
//    work although the source has no face rig;
//  - clothes: for each outfit the covered part of the body surface becomes a
//    separate skinned mesh pushed out along the normals and smoothed (so it
//    reads as fabric, not paint), with the same skin weights, so it deforms
//    exactly like the body; the covered body triangles are dropped, so the
//    skin can never poke through and the triangle count stays the same.
//    Seams, cuffs, belts, pockets, patches, zips and reflective bands are
//    drawn in the shader from the rest-pose position (crisp at any distance);
//  - clips: the pelvis track is scaled to the body, a shorter-stride jog is
//    derived from the run, natural speeds and foot-landing phases measured.
// Per character: skin tone, hair (mesh on the Head bone), clothes colours,
// helmet, height (uniform scale).
import { THREE } from './engine.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { clone as cloneSkinned } from '../../vendor/SkeletonUtils.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});
const DIR = 'assets/models/characters/';
const FILES = { m: 'ek-body-m.glb', f: 'ek-body-f.glb', hair: 'ek-hair.glb', anims: 'ek-anims.glb' };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
const TAU = Math.PI * 2;

// ---------- Looks ----------
// Skin tones s1..s6 (believable, close to the creator's swatches).
const SKIN = { s1: '#efc9ad', s2: '#dcab86', s3: '#be8862', s4: '#996444', s5: '#71472b', s6: '#4b2d1a' };
const HAIRC = { black: '#16120f', brown: '#3b2416', auburn: '#7b3519', blond: '#c7a165', grey: '#a29e99' };
// The creator's suit colours: [body, accent, trim].
const SUITS = {
  classic: ['#e9ebe6', '#e3662a', '#5a636b'],
  gold: ['#c9a24f', '#2e3338', '#6b5320'],
  teal: ['#1f7f78', '#f1e2b3', '#0f4f4b'],
  navy: ['#25365a', '#d9a21b', '#141f33'],
  orange: ['#e2622b', '#2c4a80', '#7a2f12'],
  lavender: ['#a495c8', '#4f3f86', '#5b4f74'],
};
// Flight polo colours per suit choice (shirt-sleeve cabin clothes).
const POLO = { classic: '#3d5f92', gold: '#2c3f60', teal: '#1d5f5b', navy: '#22314f', orange: '#2c4a80', lavender: '#4a4478' };

// The Last Light cast. look: the SMD.avatar-style appearance; body m|f;
// height in metres; outfit: the default for that person; colors override.
export const CAST = {
  you: { name: 'You', fromAvatar: true, outfit: 'flight' },
  yusuf: { name: 'Yusuf', body: 'm', height: 1.79, outfit: 'flight', look: { suit: 'navy', skin: 's4', hair: 'short', hairColor: 'black', patchColor: '#17807a' }, beard: 'stubble', role: 'Pilot, Egyptian, ex air force' },
  lena: { name: 'Lena', body: 'f', height: 1.72, outfit: 'flight', look: { suit: 'classic', skin: 's1', hair: 'bun', hairColor: 'blond', patchColor: '#24539a' }, role: 'ESA physician, German' },
  grace: { name: 'Grace', body: 'f', height: 1.66, outfit: 'flight', look: { suit: 'teal', skin: 's6', hair: 'curly', hairColor: 'black', patchColor: '#5b4a8a' }, role: 'Flight engineer, Nigerian' },
  kwame: { name: 'Kwame', body: 'm', height: 1.82, outfit: 'ground', look: { suit: 'navy', skin: 's5', hair: 'curly', hairColor: 'grey', patchColor: '#24539a' }, beard: 'full', colors: { top: '#2b3442', bottom: '#2f3238', accent: '#d9e04a' }, role: 'Chief engineer, Ghanaian' },
  nadia: { name: 'Nadia', body: 'f', height: 1.65, outfit: 'ground', look: { suit: 'classic', skin: 's3', hair: 'covered', hairColor: 'black', patchColor: '#5b4a8a' }, colors: { top: '#3a3550', bottom: '#24262c', accent: '#c9c2e0' }, role: 'Flight director' },
  mariam: { name: 'Mariam', body: 'f', height: 1.62, outfit: 'ground', look: { suit: 'teal', skin: 's3', hair: 'covered', hairColor: 'black', patchColor: '#4f7a32' }, colors: { top: '#e7e3d8', bottom: '#2a3140', accent: '#4f7a32' }, role: 'Mission scientist' },
  tarek: { name: 'Tarek', body: 'm', height: 1.75, outfit: 'ground', look: { suit: 'gold', skin: 's3', hair: 'short', hairColor: 'brown', patchColor: '#23282e' }, colors: { top: '#4a4f57', bottom: '#2d3036', accent: '#c9a24f' } },
  omar: { name: 'Omar', body: 'm', height: 1.72, outfit: 'ground', look: { suit: 'orange', skin: 's5', hair: 'curly', hairColor: 'black', patchColor: '#b4302c' }, colors: { top: '#b4302c', bottom: '#2b3140', accent: '#f1e2b3' } },
  aiko: { name: 'Aiko', body: 'f', height: 1.6, outfit: 'ground', look: { suit: 'lavender', skin: 's2', hair: 'bun', hairColor: 'black', patchColor: '#5b4a8a' }, colors: { top: '#6c5f96', bottom: '#2a2c33', accent: '#f5d76e' } },
};
const CAST_BY_NAME = {};
Object.keys(CAST).forEach((id) => (CAST_BY_NAME[CAST[id].name.toLowerCase()] = id));

// Appearance (+ opts) -> everything the build needs.
export function resolveLook(appearance, opts = {}) {
  const a = Object.assign({}, appearance || {});
  const castId = opts.cast || a.cast || CAST_BY_NAME[String(a.name || '').toLowerCase()] || null;
  const C = castId && CAST[castId] && castId !== 'you' ? CAST[castId] : null;
  if (C) for (const k in C.look) if (a[k] === undefined) a[k] = C.look[k];
  const hair = a.hair || 'short';
  const body = opts.body || a.body || (C && C.body) || (hair === 'bun' || hair === 'covered' ? 'f' : 'm');
  let outfit = opts.outfit || a.outfit || null;
  const helmetOpt = typeof opts.helmet === 'boolean' ? opts.helmet : null;
  const helmet = helmetOpt !== null ? helmetOpt : hair === 'helmet';
  if (!outfit) outfit = hair === 'helmet' && helmetOpt !== false ? 'launch' : (C && C.outfit) || 'flight';
  if (!['launch', 'flight', 'ground'].includes(outfit)) outfit = 'flight';
  const suit = SUITS[a.suit] ? a.suit : 'classic';
  const S = SUITS[suit];
  const colors = { top: S[0], bottom: '#2a2e36', shoe: '#1c1d20', glove: '#d9dad5', accent: S[1], trim: S[2], patch: a.patchColor && /^#/.test(a.patchColor) ? a.patchColor : '#17807a', scarf: a.patchColor && /^#/.test(a.patchColor) ? a.patchColor : '#5b4a8a', cap: '#2a2522' };
  if (outfit === 'flight') {
    colors.top = POLO[suit];
    colors.bottom = '#2a2f3a';
    colors.accent = suit === 'navy' || suit === 'gold' ? '#d9a21b' : '#d8dde3';
  } else if (outfit === 'launch') {
    // Orion crew survival suit orange; an explicit suit colour (not the
    // white classic) carries over when the old screens ask for the helmet.
    colors.top = colors.bottom = opts.outfit === 'launch' || suit === 'classic' ? '#e4672c' : S[0];
    colors.accent = '#2c4a80';
    colors.trim = '#9aa3ab';
    colors.shoe = '#17181a';
  } else {
    colors.top = '#34404f';
    colors.bottom = '#2e3137';
    colors.shoe = '#201c18'; // dark work boots (brown read as bare feet at distance)
    colors.accent = '#d6dc4e';
  }
  if (C && C.colors && outfit !== 'launch') Object.assign(colors, C.colors);
  if (opts.colors) Object.assign(colors, opts.colors);
  const height = opts.height || a.height || (C && C.height) || (body === 'f' ? 1.69 : 1.78);
  const headwear = hair === 'covered' ? 'scarf' : helmet || hair === 'helmet' ? 'cap' : 'none';
  const beard = a.beard || (C && C.beard) || null;
  return {
    castId,
    name: a.name || (C && C.name) || '',
    body,
    outfit,
    helmet,
    hair,
    headwear,
    gloves: outfit === 'launch' && helmet,
    skin: SKIN[a.skin] || SKIN.s3,
    hairColor: HAIRC[a.hairColor] || HAIRC.black,
    visor: a.visor === 'gold' ? 'gold' : 'clear',
    colors,
    height,
    beard,
  };
}

// ---------- Loading ----------
let LIB = null;
let loadP = null;
let loadFailed = false;
export function charactersReady() {
  return !!LIB;
}
export function charactersFailed() {
  return loadFailed;
}
export function preloadCharacters() {
  if (LIB) return Promise.resolve(LIB);
  if (loadP) return loadP;
  loadP = (async () => {
    const loader = new GLTFLoader();
    const base = typeof document !== 'undefined' ? document.baseURI : location.href;
    const get = (f) => loader.loadAsync(new URL(DIR + f, base).href);
    const [m, f, hair, anims] = await Promise.all([get(FILES.m), get(FILES.f), get(FILES.hair), get(FILES.anims)]);
    const hairs = {};
    hair.scene.traverse((o) => {
      if (o.isMesh) {
        hairs[o.name] = o;
        keep(o.geometry);
        o.geometry.computeBoundingSphere();
      }
    });
    let mannPelvis = null;
    anims.scene.traverse((o) => o.name === 'pelvis' && (mannPelvis = o.position.clone()));
    const clipSrc = {};
    anims.animations.forEach((c) => (clipSrc[c.name] = c));
    const lib = { hairs, hairMats: {}, clipSrc, mannPelvis };
    lib.bodies = { m: prepBody(m, 'm', lib), f: prepBody(f, 'f', lib) };
    LIB = lib;
    return lib;
  })();
  loadP.catch((e) => {
    loadFailed = true;
    console.warn('characters: falling back to the procedural astronaut', e);
  });
  return loadP;
}
function keep(x) {
  if (x && x.userData) x.userData.keep = true;
  return x;
}

// ---------- Body templates ----------
const G_HEAD = 0, G_NECK = 1, G_SPINE = 2, G_PELVIS = 3, G_UARM = 4, G_FARM = 5, G_HAND = 6, G_THIGH = 7, G_CALF = 8, G_FOOT = 9;
function boneGroup(name) {
  if (name === 'Head') return G_HEAD;
  if (name === 'neck_01') return G_NECK;
  if (/^spine|^clavicle/.test(name)) return G_SPINE;
  if (name === 'pelvis' || name === 'root') return G_PELVIS;
  if (/^upperarm/.test(name)) return G_UARM;
  if (/^lowerarm/.test(name)) return G_FARM;
  if (/^hand|index|middle|ring|pinky|thumb/.test(name)) return G_HAND;
  if (/^thigh/.test(name)) return G_THIGH;
  if (/^calf/.test(name)) return G_CALF;
  return G_FOOT;
}

function prepBody(gltf, id, lib) {
  const scene = gltf.scene;
  const T = { id, scene, bones: {}, garments: {}, align: {} };
  scene.traverse((o) => {
    if (o.isSkinnedMesh) T[o.name === 'Body' ? 'body' : o.name === 'Eyes' ? 'eyes' : 'brows'] = o;
    if (o.isBone) T.bones[o.name] = o;
  });
  const sk = T.body.skeleton;
  sk.pose();
  scene.updateMatrixWorld(true);
  [T.body, T.eyes, T.brows].forEach((m) => {
    keep(m.geometry);
    m.geometry.computeBoundingSphere();
    const mat = m.material;
    keep(mat);
    ['map', 'normalMap'].forEach((k) => mat[k] && keep(mat[k]));
  });
  T.eyes.material.roughness = 0.12;
  const bp = (n) => new THREE.Vector3().setFromMatrixPosition(T.bones[n].matrixWorld);
  T.bind = {};
  ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'clavicle_l'].forEach((n) => (T.bind[n] = bp(n)));
  T.top = 0;
  reshape(T, id);
  // Rest-pose vertex data of the body.
  const geo = T.body.geometry;
  const n = geo.attributes.position.count;
  const P = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(geo.attributes.position, i).applyMatrix4(T.body.bindMatrix);
    P[i * 3] = v.x;
    P[i * 3 + 1] = v.y;
    P[i * 3 + 2] = v.z;
    if (v.y > T.top) T.top = v.y;
  }
  T.P = P;
  const gOfBone = sk.bones.map((b) => boneGroup(b.name));
  const grp = new Uint8Array(n);
  const si = geo.attributes.skinIndex;
  const sw = geo.attributes.skinWeight;
  const acc = new Float32Array(10);
  for (let i = 0; i < n; i++) {
    acc.fill(0);
    for (let k = 0; k < 4; k++) acc[gOfBone[si.getComponent(i, k)]] += sw.getComponent(i, k);
    let best = 0;
    for (let k = 1; k < 10; k++) if (acc[k] > acc[best]) best = k;
    grp[i] = best;
  }
  T.grp = grp;
  topology(T);
  face(T);
  // Head box (helmet and headwear sizes).
  const hb = new THREE.Box3();
  for (let i = 0; i < n; i++) if (grp[i] === G_HEAD) hb.expandByPoint(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
  T.headBox = hb;
  // Align frames: an Object3D under a bone whose origin is a rest-pose point
  // and whose axes are the character's axes at rest (x left, y up, z ahead).
  const RZ = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
  const J = {
    hips: ['pelvis', 'pelvis'],
    torso: ['spine_01', 'pelvis'],
    neck: ['neck_01', 'neck_01'],
    head: ['Head', 'Head'],
    shL: ['upperarm_l', 'upperarm_l', RZ(Math.PI / 2)],
    shR: ['upperarm_r', 'upperarm_r', RZ(-Math.PI / 2)],
    elL: ['lowerarm_l', 'lowerarm_l', RZ(Math.PI / 2)],
    elR: ['lowerarm_r', 'lowerarm_r', RZ(-Math.PI / 2)],
    handL: ['hand_l', 'hand_l', RZ(Math.PI / 2)],
    handR: ['hand_r', 'hand_r', RZ(-Math.PI / 2)],
    hipL: ['thigh_l', 'thigh_l'],
    hipR: ['thigh_r', 'thigh_r'],
    knL: ['calf_l', 'calf_l'],
    knR: ['calf_r', 'calf_r'],
    ftL: ['foot_l', 'foot_l'],
    ftR: ['foot_r', 'foot_r'],
  };
  const m4 = new THREE.Matrix4();
  for (const k in J) {
    const [bone, at, rot] = J[k];
    m4.compose(T.bind[at], rot || new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().copy(T.bones[bone].matrixWorld).invert().multiply(m4);
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    local.decompose(pos, q, new THREE.Vector3());
    T.align[k] = { bone, pos, q };
  }
  prepClips(T, lib);
  headParts(T);
  return T;
}

// Everyday proportions from the "superhero" bases: a slightly bigger head,
// slimmer limbs, a less heroic chest (and narrower hips and a smaller bust on
// the female base). Done once on the shared rest-pose geometry, weighted by
// the skin weights so the changes blend smoothly.
const SHAPE = {
  m: { head: 1.075, upperarm: 0.86, lowerarm: 0.92, thigh: 0.9, calf: 0.94, chestX: 0.93, chestZ: 0.92, hipX: 1, bust: 0, neck: 0.92 },
  f: { head: 1.07, upperarm: 0.86, lowerarm: 0.93, thigh: 0.85, calf: 0.92, chestX: 0.95, chestZ: 0.95, hipX: 0.88, bust: 0.35, neck: 0.95 },
};
function reshape(T, id) {
  const S = SHAPE[id];
  const B = T.bind;
  const head = B.Head;
  const seg = (a, b) => [B[a], B[b]];
  const LIMBS = {
    upperarm_l: [seg('upperarm_l', 'lowerarm_l'), S.upperarm],
    upperarm_r: [seg('upperarm_r', 'lowerarm_r'), S.upperarm],
    lowerarm_l: [seg('lowerarm_l', 'hand_l'), S.lowerarm],
    lowerarm_r: [seg('lowerarm_r', 'hand_r'), S.lowerarm],
    thigh_l: [seg('thigh_l', 'calf_l'), S.thigh],
    thigh_r: [seg('thigh_r', 'calf_r'), S.thigh],
    calf_l: [seg('calf_l', 'foot_l'), S.calf],
    calf_r: [seg('calf_r', 'foot_r'), S.calf],
  };
  const v = new THREE.Vector3(), q = new THREE.Vector3(), ab = new THREE.Vector3();
  const spineZ = (B.spine_03.z + B.spine_02.z) / 2;
  const doMesh = (mesh, headOnly) => {
    const g = mesh.geometry;
    const pos = g.attributes.position;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const names = mesh.skeleton.bones.map((b) => b.name);
    const inv = new THREE.Matrix4().copy(mesh.bindMatrix).invert();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix);
      const w = {};
      for (let k = 0; k < 4; k++) {
        const nm = names[si.getComponent(i, k)];
        w[nm] = (w[nm] || 0) + sw.getComponent(i, k);
      }
      const o = v.clone();
      // Head (and everything on it) bigger about the Head bone.
      const wh = headOnly ? 1 : w.Head || 0;
      if (wh > 0) o.sub(head).multiplyScalar(1 + (S.head - 1) * wh).add(head);
      if (!headOnly) {
        // Neck a little thinner.
        const wn = w.neck_01 || 0;
        if (wn > 0) {
          o.x *= 1 - (1 - S.neck) * wn;
          o.z = B.neck_01.z + (o.z - B.neck_01.z) * (1 - (1 - S.neck) * wn);
        }
        // Limbs toward their bone axis.
        for (const b in LIMBS) {
          const wb = w[b] || 0;
          if (!wb) continue;
          const [[A, C], f] = LIMBS[b];
          ab.subVectors(C, A);
          const t = clamp(q.subVectors(v, A).dot(ab) / ab.lengthSq(), 0, 1);
          q.copy(A).addScaledVector(ab, t);
          o.addScaledVector(v.clone().sub(q), (f - 1) * wb);
        }
        // Chest and back (spine, clavicles).
        const wc = (w.spine_02 || 0) * 0.6 + (w.spine_03 || 0) + (w.clavicle_l || 0) * 0.7 + (w.clavicle_r || 0) * 0.7;
        if (wc > 0) {
          o.x *= 1 - (1 - S.chestX) * Math.min(1, wc);
          o.z = spineZ + (o.z - spineZ) * (1 - (1 - S.chestZ) * Math.min(1, wc));
        }
        // Hips.
        const wp = (w.pelvis || 0) + 0.5 * ((w.thigh_l || 0) + (w.thigh_r || 0)) * (v.y > B.calf_l.y + 0.25 ? 1 : 0);
        if (wp > 0 && S.hipX !== 1) o.x *= 1 - (1 - S.hipX) * Math.min(1, wp) * smooth((B.spine_01.y + 0.05 - v.y) / 0.15);
        // Bust.
        if (S.bust && v.z > spineZ + 0.08 && v.y > B.spine_02.y - 0.05 && v.y < B.spine_03.y + 0.12) {
          const k = smooth((v.z - (spineZ + 0.08)) / 0.06) * (1 - smooth(Math.abs(v.y - (B.spine_03.y + 0.0)) / 0.12) * 0) * Math.min(1, wc + (w.spine_02 || 0));
          o.z -= (v.z - (spineZ + 0.08)) * S.bust * k;
        }
      }
      o.applyMatrix4(inv);
      pos.setXYZ(i, o.x, o.y, o.z);
    }
    pos.needsUpdate = true;
    g.computeBoundingSphere();
  };
  doMesh(T.body, false);
  doMesh(T.eyes, true);
  doMesh(T.brows, true);
  T.headScale = S.head;
}

// Welded vertex graph (UV seams split vertices; smoothing and normals need
// the surface as one piece).
function topology(T) {
  const P = T.P;
  const n = P.length / 3;
  const weld = new Int32Array(n);
  const map = new Map();
  let u = 0;
  for (let i = 0; i < n; i++) {
    const key = Math.round(P[i * 3] * 2e4) + ',' + Math.round(P[i * 3 + 1] * 2e4) + ',' + Math.round(P[i * 3 + 2] * 2e4);
    let w = map.get(key);
    if (w === undefined) {
      w = u++;
      map.set(key, w);
    }
    weld[i] = w;
  }
  const idx = T.body.geometry.index.array;
  const adj = Array.from({ length: u }, () => new Set());
  const nrm = new Float32Array(u * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2];
    const w0 = weld[i0], w1 = weld[i1], w2 = weld[i2];
    adj[w0].add(w1).add(w2);
    adj[w1].add(w0).add(w2);
    adj[w2].add(w0).add(w1);
    a.fromArray(P, i0 * 3);
    b.fromArray(P, i1 * 3);
    c.fromArray(P, i2 * 3);
    b.sub(a);
    c.sub(a);
    b.cross(c); // area-weighted
    for (const w of [w0, w1, w2]) {
      nrm[w * 3] += b.x;
      nrm[w * 3 + 1] += b.y;
      nrm[w * 3 + 2] += b.z;
    }
  }
  for (let w = 0; w < u; w++) {
    const l = Math.hypot(nrm[w * 3], nrm[w * 3 + 1], nrm[w * 3 + 2]) || 1;
    nrm[w * 3] /= l;
    nrm[w * 3 + 1] /= l;
    nrm[w * 3 + 2] /= l;
  }
  T.weld = weld;
  T.nWeld = u;
  T.adj = adj.map((s) => Int32Array.from(s));
  T.wN = nrm;
}

// ---------- Face: morph targets made from the geometry ----------
const MORPHS = ['blink', 'smile', 'frown', 'browUp', 'browSad', 'browAngry', 'open', 'squint'];
function face(T) {
  const P = T.P;
  const n = P.length / 3;
  // Eyeballs: two spheres in the Eyes mesh.
  const eg = T.eyes.geometry.attributes.position;
  const boxes = [new THREE.Box3(), new THREE.Box3()];
  const v = new THREE.Vector3();
  for (let i = 0; i < eg.count; i++) {
    v.fromBufferAttribute(eg, i).applyMatrix4(T.eyes.bindMatrix);
    boxes[v.x > 0 ? 0 : 1].expandByPoint(v);
  }
  const eyes = boxes.map((b) => {
    const r = (b.max.x - b.min.x) / 2;
    return { x: (b.max.x + b.min.x) / 2, y: (b.max.y + b.min.y) / 2, front: b.max.z, z: b.max.z - r, r };
  });
  const eyeY = (eyes[0].y + eyes[1].y) / 2;
  const eyeFront = Math.max(eyes[0].front, eyes[1].front);
  T.eye = { y: eyeY, front: eyeFront, x: eyes[0].x, r: eyes[0].r };
  // Lips: the redder texels of the lower face.
  const mouth = { x: 0, y: eyeY - 0.075, z: eyeFront + 0.004, hw: 0.024 };
  try {
    const img = T.body.material.map.image;
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, S, S);
    const d = g.getImageData(0, 0, S, S).data;
    const uv = T.body.geometry.attributes.uv;
    const lb = new THREE.Box3();
    let cnt = 0;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (T.grp[i] !== G_HEAD || Math.abs(x) > 0.04 || y > eyeY - 0.05 || y < eyeY - 0.12 || z < eyeFront - 0.04) continue;
      const px = clamp(Math.floor(uv.getX(i) * S), 0, S - 1);
      const py = clamp(Math.floor(uv.getY(i) * S), 0, S - 1);
      const o = (py * S + px) * 4;
      if (d[o] - d[o + 1] > 26 && d[o] > d[o + 1] * 1.14) {
        lb.expandByPoint(v.set(x, y, z));
        cnt++;
      }
    }
    if (cnt >= 6 && lb.max.x - lb.min.x > 0.02) {
      mouth.x = 0;
      mouth.y = (lb.max.y + lb.min.y) / 2;
      mouth.z = lb.max.z;
      mouth.hw = (lb.max.x - lb.min.x) / 2;
      mouth.top = lb.max.y;
      mouth.bottom = lb.min.y;
    }
  } catch (e) {}
  T.mouth = mouth;
  const R = eyes[0].r;
  const morph = (pts, getX, isBrows) => {
    const cnt = pts.length / 3;
    const out = {};
    MORPHS.forEach((k) => (out[k] = new Float32Array(cnt * 3)));
    for (let i = 0; i < cnt; i++) {
      const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
      if (!getX(i)) continue;
      if (z < eyeFront - 0.07) continue;
      const side = x >= 0 ? 0 : 1;
      const e = eyes[side];
      const dx = x - e.x;
      const dy = y - e.y;
      // Upper lid: closes down over the eyeball.
      if (!isBrows && dy > -0.2 * R && z > e.z - 0.2 * R) {
        const rr = Math.hypot(dx / (1.3 * R), dy / (1.05 * R));
        const w = 1 - smooth((rr - 1.12) / 1.0);
        if (w > 0) {
          const target = e.y - 0.35 * R;
          let ny = y + (target - y) * w * (rr < 1.12 ? 1 : 0.55);
          // keep in front of the eyeball
          const vx = x - e.x, vy = ny - e.y, vz = z - e.z;
          const dist = Math.hypot(vx, vy, vz);
          let nz = z;
          const need = e.r + 0.0016;
          if (dist < need && w > 0.3) nz = e.z + Math.sqrt(Math.max(0, need * need - vx * vx - vy * vy));
          out.blink[i * 3 + 1] = ny - y;
          out.blink[i * 3 + 2] = Math.max(0, nz - z);
        }
        // Squint: the lower lid up a little (and the cheek).
      }
      if (!isBrows && dy < 0 && dy > -2.2 * R && Math.abs(dx) < 1.6 * R && z > e.z) {
        const w = 1 - smooth((Math.hypot(dx / (1.4 * R), dy / (1.5 * R)) - 0.9) / 0.9);
        out.squint[i * 3 + 1] = 0.0035 * w;
      }
      // Brows: the band above the eye.
      const by = dy - 1.9 * R;
      if (Math.abs(dx) < 2.4 * R && by > -1.1 * R && by < 1.6 * R) {
        const w = (1 - smooth((Math.abs(dx) - 1.5 * R) / (0.9 * R))) * (1 - smooth((Math.abs(by) - 0.5 * R) / (1.0 * R)));
        const inner = clamp(1 - Math.abs(x) / (Math.abs(e.x) + 1.2 * R), 0, 1); // 1 at the nose
        out.browUp[i * 3 + 1] = 0.0045 * w;
        out.browSad[i * 3 + 1] = (0.005 * inner - 0.0012 * (1 - inner)) * w;
        out.browSad[i * 3] = -Math.sign(x) * 0.0008 * inner * w;
        out.browAngry[i * 3 + 1] = -0.0035 * inner * w;
        out.browAngry[i * 3] = -Math.sign(x) * 0.0015 * inner * w;
        out.browAngry[i * 3 + 2] = 0.001 * inner * w;
      }
      if (isBrows) continue;
      // Mouth corners and lips.
      const mx = Math.abs(x) - mouth.hw;
      const cy = y - mouth.y;
      const cw = 1 - smooth((Math.hypot(mx, cy * 1.2) - 0.006) / 0.02);
      if (cw > 0 && z > mouth.z - 0.03) {
        out.smile[i * 3] = Math.sign(x) * 0.0022 * cw;
        out.smile[i * 3 + 1] = 0.0042 * cw;
        out.smile[i * 3 + 2] = -0.0018 * cw;
        out.frown[i * 3 + 1] = -0.0032 * cw;
        out.frown[i * 3] = Math.sign(x) * 0.0006 * cw;
      }
      // Cheeks lift with the smile.
      const ck = Math.hypot(Math.abs(x) - (mouth.hw + 0.012), y - (mouth.y + 0.028));
      const cheek = 1 - smooth((ck - 0.006) / 0.024);
      if (cheek > 0) {
        out.smile[i * 3 + 1] += 0.0022 * cheek;
        out.smile[i * 3 + 2] += 0.0012 * cheek;
      }
      // Jaw open: the lower lip and chin go down.
      if (Math.abs(x) < mouth.hw + 0.03 && cy < -0.001 && cy > -0.06 && z > mouth.z - 0.035) {
        const wx = 1 - smooth((Math.abs(x) - mouth.hw * 0.6) / 0.03);
        const wy = cy > -0.012 ? 1 : 1 - smooth((-cy - 0.012) / 0.05) * 0.4;
        out.open[i * 3 + 1] = -0.0065 * wx * wy;
        out.open[i * 3 + 2] = -0.0012 * wx * wy;
      } else if (Math.abs(x) < mouth.hw + 0.01 && cy >= -0.001 && cy < 0.008 && z > mouth.z - 0.02) {
        out.open[i * 3 + 1] = 0.0012 * (1 - smooth(cy / 0.008));
      }
    }
    return out;
  };
  const isHead = (i) => T.grp[i] === G_HEAD;
  const bodyM = morph(P, isHead, false);
  const geo = T.body.geometry;
  geo.morphAttributes.position = MORPHS.map((k) => {
    const at = new THREE.BufferAttribute(bodyM[k], 3);
    at.name = k;
    return at;
  });
  geo.morphTargetsRelative = true;
  // Brows mesh: its own copy of the brow morphs.
  const bg = T.brows.geometry;
  const bc = bg.attributes.position.count;
  const BP = new Float32Array(bc * 3);
  for (let i = 0; i < bc; i++) {
    v.fromBufferAttribute(bg.attributes.position, i).applyMatrix4(T.brows.bindMatrix);
    v.toArray(BP, i * 3);
  }
  const browM = morph(BP, () => true, true);
  bg.morphAttributes.position = MORPHS.map((k) => {
    const at = new THREE.BufferAttribute(browM[k], 3);
    at.name = k;
    return at;
  });
  bg.morphTargetsRelative = true;
}

// ---------- Clips ----------
// Names for play(): our name -> [source clip, { loop, once, seat, float }]
const CLIPS = {
  idle: ['Idle_Loop'],
  talk: ['Idle_Talking_Loop'],
  torch: ['Idle_Torch_Loop'],
  walk: ['Walk_Loop'],
  run: ['Jog_Fwd_Loop'],
  sprint: ['Sprint_Loop'],
  jog: ['@jog'],
  crouch: ['Crouch_Idle_Loop'],
  crouchWalk: ['Crouch_Fwd_Loop'],
  tread: ['Swim_Idle_Loop'],
  swimStroke: ['Swim_Fwd_Loop'],
  interact: ['Interact', { once: true }],
  pickup: ['PickUp_Table', { once: true }],
  push: ['Push_Loop'],
  fix: ['Fixing_Kneeling'],
  sitDown: ['Sitting_Enter', { once: true, seat: true }],
  sit: ['Sitting_Idle_Loop', { seat: true }],
  sitTalk: ['Sitting_Talking_Loop', { seat: true }],
  standUp: ['Sitting_Exit', { once: true, seat: true }],
  drive: ['Driving_Loop', { seat: true }],
  jumpStart: ['Jump_Start', { once: true }],
  jumpAir: ['Jump_Loop'],
  jumpLand: ['Jump_Land', { once: true }],
  hit: ['Hit_Chest', { once: true }],
  fall: ['Death01', { once: true, clamp: true }],
  dance: ['Dance_Loop'],
};
// Other names people (and level scripts) use.
const ALIAS = {
  reachOut: 'reach', grab: 'pickup', take: 'pickup', press: 'interact', flip: 'interact', switch: 'interact', button: 'interact', use: 'interact', type: 'interact', open: 'interact', pull: 'push', repair: 'fix', kneel: 'fix', weld: 'fix', pilot: 'drive', steer: 'drive', seat: 'sit', sitIdle: 'sit', chat: 'talk', speak: 'talk', explain: 'talk', count: 'talk', argue: 'talk', jump: 'hop', die: 'fall', collapse: 'fall', faint: 'fall', freeze: 'tense', scared: 'tense', fear: 'tense', worry: 'tense', duck: 'brace', cover: 'brace', impact: 'brace', shake: 'brace', look: 'lookAround', search: 'lookAround', scan: 'lookAround', celebrate: 'celebrate', joy: 'celebrate', yay: 'celebrate', fistpump: 'cheer', thumbsup: 'cheer', nod: 'nod', no: 'shake', cry: 'sad', mourn: 'sad', tired: 'sad', flashlight: 'torch', torchOn: 'torch', swim: 'swimStroke', float: 'float', hold: 'carry', lift: 'pickup', sleep: 'rest', laydown: 'lie', lieDown: 'lie', getUp: 'stand', standup: 'standUp', idle: 'idle', wait: 'idle', stand: 'stand', point: 'point', hello: 'wave', hi: 'wave', bye: 'wave', salute: 'salute' };

function prepClips(T, lib) {
  const src = lib.clipSrc;
  const k = T.bones.pelvis.position.z / (lib.mannPelvis ? lib.mannPelvis.z : T.bones.pelvis.position.z);
  T.clips = {};
  for (const name in CLIPS) {
    const s = CLIPS[name][0];
    if (s[0] === '@') continue;
    const c = src[s];
    if (!c) continue;
    const clip = c.clone();
    clip.name = name;
    clip.tracks = clip.tracks.filter((t) => {
      if (t.name === 'pelvis.position') {
        if (/^Swim/.test(s)) return false;
        const vv = t.values;
        for (let i = 0; i < vv.length; i++) vv[i] *= k;
      }
      return true;
    });
    T.clips[name] = clip;
  }
  // A shorter-stride jog: the run with its swing scaled down about the mean.
  T.clips.jog = scaleClip(T.clips.run, 0.56, 'jog');
  // Measure natural speeds and foot landings on the template.
  T.loco = {};
  const mixer = new THREE.AnimationMixer(T.scene);
  const pl = new THREE.Vector3(), pr = new THREE.Vector3(), al = new THREE.Vector3(), ar = new THREE.Vector3();
  const sample = (clip, N, fn) => {
    const a = mixer.clipAction(clip);
    a.play();
    for (let i = 0; i <= N; i++) {
      a.time = (i / N) * clip.duration;
      mixer.update(0);
      T.scene.updateMatrixWorld(true);
      fn(i);
    }
    a.stop();
  };
  for (const name of ['walk', 'jog', 'run', 'sprint']) {
    const clip = T.clips[name];
    const N = 96;
    const L = [], R = [], AL = [], AR = [];
    sample(clip, N, () => {
      L.push(pl.setFromMatrixPosition(T.bones.ball_l.matrixWorld).toArray());
      R.push(pr.setFromMatrixPosition(T.bones.ball_r.matrixWorld).toArray());
      AL.push(al.setFromMatrixPosition(T.bones.foot_l.matrixWorld).y);
      AR.push(ar.setFromMatrixPosition(T.bones.foot_r.matrixWorld).y);
    });
    const dt = clip.duration / N;
    let sv = 0, sn = 0;
    for (let i = 0; i < N; i++) {
      for (const [F, O] of [[L, R], [R, L]]) {
        if (F[i][1] < O[i][1] - 0.02 && F[i + 1][1] < O[i + 1][1] - 0.02) {
          sv += -(F[i + 1][2] - F[i][2]) / dt;
          sn++;
        }
      }
    }
    const v = sn ? sv / sn : 1;
    const land = [AL, AR].map((A) => {
      const mn = Math.min(...A), mx = Math.max(...A);
      const th = mn + 0.18 * (mx - mn);
      for (let i = 1; i <= N; i++) if (A[i] <= th && A[i - 1] > th) return i / N;
      return 0;
    });
    T.loco[name] = { clip, v, dur: clip.duration, L: v * clip.duration, land };
  }
  // Pelvis heights: standing and seated (for the seat fit).
  const ph = new THREE.Vector3();
  sample(T.clips.idle, 1, () => (T.standPelvis = ph.setFromMatrixPosition(T.bones.pelvis.matrixWorld).y));
  sample(T.clips.idle, 1, () => (T.ankleY = ph.setFromMatrixPosition(T.bones.foot_l.matrixWorld).y));
  sample(T.clips.sit, 1, () => (T.sitPelvis = ph.setFromMatrixPosition(T.bones.pelvis.matrixWorld).y));
  mixer.stopAllAction();
  mixer.uncacheRoot(T.scene);
  T.body.skeleton.pose();
  T.scene.updateMatrixWorld(true);
}
function scaleClip(clip, amp, name) {
  const c = clip.clone();
  c.name = name;
  const q = new THREE.Quaternion(), m = new THREE.Quaternion(), r = new THREE.Quaternion();
  c.tracks.forEach((t) => {
    const vals = t.values;
    if (t.name.endsWith('.quaternion')) {
      const n = vals.length / 4;
      m.set(0, 0, 0, 0);
      const first = new THREE.Quaternion().fromArray(vals, 0);
      for (let i = 0; i < n; i++) {
        q.fromArray(vals, i * 4);
        if (q.dot(first) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        m.x += q.x; m.y += q.y; m.z += q.z; m.w += q.w;
      }
      m.normalize();
      for (let i = 0; i < n; i++) {
        q.fromArray(vals, i * 4);
        r.copy(m).slerp(q, amp);
        r.toArray(vals, i * 4);
      }
    } else if (t.name.endsWith('.position')) {
      const n = vals.length / 3;
      for (let k = 0; k < 3; k++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += vals[i * 3 + k];
        s /= n;
        for (let i = 0; i < n; i++) vals[i * 3 + k] = s + (vals[i * 3 + k] - s) * (k === 2 ? amp * 0.9 : amp);
      }
    }
  });
  return c;
}

// ---------- Clothes ----------
// Outfit cut lines (rest pose, metres; arms are along x in the T-pose).
function cuts(T, outfit) {
  const B = T.bind;
  const shX = B.upperarm_l.x, elX = B.lowerarm_l.x, wrX = B.hand_l.x;
  const neckY = B.neck_01.y;
  const hipY = B.pelvis.y;
  return {
    sleeve: outfit === 'flight' ? shX + (elX - shX) * 0.5 : wrX - 0.035,
    wrist: wrX - 0.035,
    elbow: elX,
    neck: outfit === 'launch' ? neckY + 0.035 : neckY - 0.005,
    waist: hipY + 0.085,
    hip: hipY,
    knee: B.calf_l.y,
    ankle: B.foot_l.y,
    shoe: B.foot_l.y + (outfit === 'flight' ? 0.03 : outfit === 'ground' ? 0.085 : 0.11),
    chest: B.spine_03.y,
    shX,
    legX: B.thigh_l.x,
  };
}
const THICK = {
  flight: { top: 0.014, torso: 0.018, bottom: 0.014, shoe: 0.017 },
  launch: { top: 0.026, torso: 0.032, bottom: 0.03, shoe: 0.024, glove: 0.008 },
  ground: { top: 0.028, torso: 0.03, bottom: 0.016, shoe: 0.021 },
};
const neckCut = (C, z) => C.neck + 0.02 * smooth((-0.03 - z) / 0.04);
function garment(T, outfit, headwear, gloves) {
  const key = outfit + '|' + headwear + '|' + (gloves ? 1 : 0);
  if (T.garments[key]) return T.garments[key];
  const P = T.P, grp = T.grp, weld = T.weld;
  const n = P.length / 3;
  const C = cuts(T, outfit);
  const th = THICK[outfit];
  const E = T.eye;
  const cover = new Int8Array(n).fill(-1); // -1 skin, 0 clothes, 4 scarf, 5 cap
  const thick = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const ax = Math.abs(x);
    const g = grp[i];
    const isArm = g === G_UARM || g === G_FARM || g === G_HAND || (ax > C.shX + 0.04 && y > C.chest - 0.08);
    if (g === G_HEAD || (g === G_NECK && y > C.neck)) {
      // Headwear.
      const fx = x / 0.066;
      const fy = (y - (E.y - 0.03)) / 0.088;
      const inFace = z > E.front - 0.05 && fx * fx + fy * fy < 1;
      if (headwear === 'scarf' && !inFace) {
        cover[i] = 4;
        thick[i] = g === G_NECK ? 0.012 : 0.011;
      } else if (headwear === 'cap' && !inFace && (y > E.y + 0.025 || z < E.front - 0.075) && y > E.y - 0.07) {
        cover[i] = 5;
        thick[i] = 0.005;
      }
      continue;
    }
    if (g === G_NECK) {
      // The collar: a little higher at the back.
      const cut = neckCut(C, z);
      if (headwear === 'scarf') {
        cover[i] = 4;
        thick[i] = 0.012;
      } else if (y < cut) {
        cover[i] = 0;
        thick[i] = th.top;
      }
      continue;
    }
    if (isArm) {
      if (ax >= C.wrist) {
        if (gloves) {
          cover[i] = 0;
          thick[i] = th.glove || 0.005;
        }
      } else if (ax < C.sleeve) {
        cover[i] = 0;
        thick[i] = th.top * (ax < C.shX + 0.05 ? 1.1 : 1);
      }
      continue;
    }
    // Torso, pelvis and legs.
    if (y > C.waist) {
      cover[i] = 0;
      thick[i] = th.torso;
    } else if (y > C.shoe || g === G_PELVIS || g === G_SPINE) {
      cover[i] = 0;
      thick[i] = y > C.knee ? th.bottom * 1.1 : th.bottom;
    } else {
      cover[i] = 0;
      thick[i] = th.shoe;
    }
  }
  // Seam duplicates agree (decide by the welded vertex).
  const wc = new Int8Array(T.nWeld).fill(-2);
  const wt = new Float32Array(T.nWeld);
  for (let i = 0; i < n; i++) {
    const w = weld[i];
    if (wc[w] === -2 || cover[i] > wc[w]) wc[w] = cover[i];
    wt[w] = Math.max(wt[w], thick[i]);
  }
  for (let i = 0; i < n; i++) {
    cover[i] = wc[weld[i]];
    thick[i] = wt[weld[i]];
  }
  // Triangles. The clothes take one extra ring of triangles past their
  // edge; the shader cuts them exactly on the hem line (crisp collars and
  // cuffs instead of the mesh's stair steps). The body keeps that ring too.
  const idx = T.body.geometry.index.array;
  const gTris = [], bTris = [];
  const ring = new Int8Array(n).fill(-1);
  const ringT = new Float32Array(n);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ca = cover[a] >= 0, cb = cover[b] >= 0, cc = cover[c] >= 0;
    if (ca || cb || cc) gTris.push(a, b, c);
    if (!(ca && cb && cc)) bTris.push(a, b, c);
    if ((ca || cb || cc) && !(ca && cb && cc)) {
      for (const i of [a, b, c]) {
        if (cover[i] >= 0) continue;
        for (const j of [a, b, c]) {
          if (cover[j] < 0) continue;
          ring[i] = Math.max(ring[i], cover[j]);
          ringT[i] = Math.max(ringT[i], thick[j]);
        }
      }
    }
  }
  for (let i = 0; i < n; i++) if (ring[i] >= 0) {
    const w = weld[i];
    if (wc[w] < 0) wt[w] = Math.max(wt[w], ringT[i]);
  }
  // Welded displacement + Taubin smoothing (no shrink), boundary fixed.
  const U = T.nWeld;
  const inG = new Uint8Array(U);
  const border = new Uint8Array(U);
  for (let i = 0; i < n; i++) if (cover[i] >= 0 || ring[i] >= 0) inG[weld[i]] = 1;
  for (let w = 0; w < U; w++) if (inG[w]) for (const o of T.adj[w]) if (!inG[o]) border[w] = 1;
  const orig = new Float32Array(U * 3);
  for (let i = 0; i < n; i++) {
    const w = weld[i];
    orig[w * 3] = P[i * 3];
    orig[w * 3 + 1] = P[i * 3 + 1];
    orig[w * 3 + 2] = P[i * 3 + 2];
  }
  const cur = new Float32Array(U * 3);
  const N = T.wN;
  for (let w = 0; w < U; w++) {
    let t = wt[w];
    // Soles stay near the floor.
    if (N[w * 3 + 1] < -0.6 && orig[w * 3 + 1] < 0.06) t = Math.min(t, 0.004);
    for (let k = 0; k < 3; k++) cur[w * 3 + k] = orig[w * 3 + k] + N[w * 3 + k] * t;
  }
  tubes(T, outfit, C, cur, orig, inG, border);
  const tmp = new Float32Array(U * 3);
  const pass = (lam) => {
    for (let w = 0; w < U; w++) {
      if (!inG[w] || border[w]) continue;
      const nb = T.adj[w];
      let sx = 0, sy = 0, sz = 0, c = 0;
      for (const o of nb) {
        if (!inG[o]) continue;
        sx += cur[o * 3];
        sy += cur[o * 3 + 1];
        sz += cur[o * 3 + 2];
        c++;
      }
      if (!c) continue;
      tmp[w * 3] = cur[w * 3] + lam * (sx / c - cur[w * 3]);
      tmp[w * 3 + 1] = cur[w * 3 + 1] + lam * (sy / c - cur[w * 3 + 1]);
      tmp[w * 3 + 2] = cur[w * 3 + 2] + lam * (sz / c - cur[w * 3 + 2]);
    }
    for (let w = 0; w < U; w++) if (inG[w] && !border[w]) for (let k = 0; k < 3; k++) cur[w * 3 + k] = tmp[w * 3 + k];
  };
  const iters = outfit === 'flight' ? 7 : 10;
  for (let it = 0; it < iters; it++) {
    pass(0.5);
    pass(-0.53);
  }
  // Shoes lose the toes; the crotch and seat get a softer drape.
  const extra = new Uint8Array(U);
  for (let i = 0; i < n; i++) {
    const y = P[i * 3 + 1], ax = Math.abs(P[i * 3]);
    if (cover[i] === 0 && ((y < C.shoe + 0.02 && ax < 0.3) || (y > C.hip - 0.2 && y < C.hip + 0.04 && ax < 0.16))) extra[weld[i]] = 1;
  }
  const passM = (lam) => {
    for (let w = 0; w < U; w++) {
      if (!extra[w] || border[w]) continue;
      let sx = 0, sy = 0, sz = 0, c = 0;
      for (const o of T.adj[w]) {
        if (!inG[o]) continue;
        sx += cur[o * 3];
        sy += cur[o * 3 + 1];
        sz += cur[o * 3 + 2];
        c++;
      }
      if (!c) continue;
      tmp[w * 3] = cur[w * 3] + lam * (sx / c - cur[w * 3]);
      tmp[w * 3 + 1] = cur[w * 3 + 1] + lam * (sy / c - cur[w * 3 + 1]);
      tmp[w * 3 + 2] = cur[w * 3 + 2] + lam * (sz / c - cur[w * 3 + 2]);
    }
    for (let w = 0; w < U; w++) if (extra[w] && !border[w]) for (let k = 0; k < 3; k++) cur[w * 3 + k] = tmp[w * 3 + k];
  };
  for (let it = 0; it < 12; it++) {
    passM(0.6);
    passM(-0.62);
  }
  // Keep clear of the skin.
  for (let w = 0; w < U; w++) {
    if (!inG[w]) continue;
    const d = (cur[w * 3] - orig[w * 3]) * N[w * 3] + (cur[w * 3 + 1] - orig[w * 3 + 1]) * N[w * 3 + 1] + (cur[w * 3 + 2] - orig[w * 3 + 2]) * N[w * 3 + 2];
    const need = wt[w] * 0.55;
    if (d < need) for (let k = 0; k < 3; k++) cur[w * 3 + k] += N[w * 3 + k] * (need - d);
  }
  // Cloth: one vertex per welded position (no UV seams needed: it is
  // shaded procedurally), then decimated, since the smoothed fabric does not
  // need the body's muscle detail.
  const src = T.body.geometry;
  const wid = new Int32Array(U).fill(-1);
  const rep = [];
  for (const i of gTris) {
    const w = weld[i];
    if (wid[w] < 0) (wid[w] = rep.length), rep.push(i);
  }
  const m = rep.length;
  const pos = new Float32Array(m * 3);
  const reg = new Float32Array(m);
  const sIdx = new Uint16Array(m * 4);
  const sWt = new Float32Array(m * 4);
  const lock = new Uint8Array(m);
  const inv = new THREE.Matrix4().copy(T.body.bindMatrix).invert();
  const v = new THREE.Vector3();
  rep.forEach((i, j) => {
    const w = weld[i];
    v.set(cur[w * 3], cur[w * 3 + 1], cur[w * 3 + 2]).applyMatrix4(inv);
    v.toArray(pos, j * 3);
    reg[j] = cover[i] >= 0 ? cover[i] : Math.max(0, ring[i]);
    lock[j] = border[w] || cover[i] < 0 ? 1 : 0;
    for (let k = 0; k < 4; k++) {
      sIdx[j * 4 + k] = src.attributes.skinIndex.getComponent(i, k);
      sWt[j * 4 + k] = src.attributes.skinWeight.getComponent(i, k);
    }
  });
  let tris = [];
  for (let t = 0; t < gTris.length; t += 3) {
    const x = wid[weld[gTris[t]]], y = wid[weld[gTris[t + 1]]], z = wid[weld[gTris[t + 2]]];
    if (x !== y && y !== z && x !== z) tris.push(x, y, z);
  }
  // Lock the hem ring's inner neighbours too, so cut lines keep geometry.
  for (let t = 0; t < tris.length; t += 3) {
    const l = lock[tris[t]] | lock[tris[t + 1]] | lock[tris[t + 2]];
    if (l === 1) for (let k = 0; k < 3; k++) if (!lock[tris[t + k]]) lock[tris[t + k]] = 2;
  }
  const before = tris.length / 3;
  tris = decimate(pos, tris, lock, reg, Math.round(before * DECIMATE[outfit]));
  const out = { cloth: { pos, reg, sIdx, sWt, tris }, bodyTris: bTris, cuts: C, eye: T.eye, clothTris: tris.length / 3, clothTrisFull: before };
  T.garments[key] = out;
  return out;
}

// Trousers and sleeves hang as cloth: each limb section is pushed out toward
// a smooth envelope round its bone (below the knee the trouser leg falls
// straight from the knee), instead of following every muscle.
function tubes(T, outfit, C, cur, orig, inG, border) {
  const B = T.bind;
  const n = T.P.length / 3;
  const U = T.nWeld;
  const wg = new Int8Array(U).fill(-1);
  for (let i = 0; i < n; i++) wg[T.weld[i]] = T.grp[i];
  const specs = [];
  for (const sd of ['l', 'r']) {
    const sg = sd === 'l' ? 1 : -1;
    specs.push({ A: B['thigh_' + sd], C: B['calf_' + sd], sg, leg: true, k: 0.75, hang: false });
    specs.push({ A: B['calf_' + sd], C: B['foot_' + sd], sg, leg: true, k: 0.85, hang: 0.955 });
    specs.push({ A: B['upperarm_' + sd], C: B['lowerarm_' + sd], sg, leg: false, k: 0.8, hang: outfit === 'flight' ? 0.99 : 0 });
    specs.push({ A: B['lowerarm_' + sd], C: B['hand_' + sd], sg, leg: false, k: 0.65, hang: 0 });
  }
  const ab = new THREE.Vector3(), q = new THREE.Vector3(), o = new THREE.Vector3(), rv = new THREE.Vector3();
  const NB = 14;
  for (const S of specs) {
    ab.subVectors(S.C, S.A);
    const L2 = ab.lengthSq();
    const items = [];
    const rmax = new Float32Array(NB);
    const rsum = new Float32Array(NB), rcnt = new Float32Array(NB);
    for (let w = 0; w < U; w++) {
      if (!inG[w] || border[w]) continue;
      o.set(orig[w * 3], orig[w * 3 + 1], orig[w * 3 + 2]);
      if (Math.sign(o.x) !== S.sg) continue;
      const g = wg[w];
      const isArm = g === G_UARM || g === G_FARM || g === G_HAND;
      if (S.leg) {
        if (isArm || !(g === G_THIGH || g === G_CALF || g === G_FOOT || g === G_PELVIS)) continue;
        if (o.y > C.hip - 0.07 || o.y < C.shoe + 0.004) continue;
      } else {
        if (!isArm || Math.abs(o.x) > C.sleeve - 0.002) continue;
      }
      const t = q.subVectors(o, S.A).dot(ab) / L2;
      if (t < 0 || t >= 1) continue;
      q.copy(S.A).addScaledVector(ab, t);
      rv.set(cur[w * 3] - q.x, cur[w * 3 + 1] - q.y, cur[w * 3 + 2] - q.z);
      const r = rv.length();
      const b = Math.min(NB - 1, Math.floor(t * NB));
      rmax[b] = Math.max(rmax[b], r);
      rsum[b] += r;
      rcnt[b]++;
      items.push(w, b, t);
    }
    const E = new Float32Array(NB);
    const mean = (b) => (rcnt[b] ? rsum[b] / rcnt[b] : 0);
    for (let b = 0; b < NB; b++) {
      const l = mean(Math.max(0, b - 1)), r = mean(Math.min(NB - 1, b + 1));
      E[b] = (l + 2 * mean(b) + r) / 4 * 1.05 + 0.003;
      if (S.hang && b > 0) E[b] = Math.max(E[b], E[b - 1] * S.hang);
    }
    for (let k = 0; k < items.length; k += 3) {
      const w = items[k], b = items[k + 1], t = items[k + 2];
      q.copy(S.A).addScaledVector(ab, t);
      rv.set(cur[w * 3] - q.x, cur[w * 3 + 1] - q.y, cur[w * 3 + 2] - q.z);
      const r = rv.length() || 1e-6;
      const r2 = r + Math.max(0, E[b] - r) * S.k;
      cur[w * 3] = q.x + (rv.x / r) * r2;
      cur[w * 3 + 1] = q.y + (rv.y / r) * r2;
      cur[w * 3 + 2] = q.z + (rv.z / r) * r2;
    }
  }
}

// Shortest-edge collapse with manifold and flip checks; locked vertices
// (hems) and region borders stay.
const DECIMATE = { flight: 0.55, launch: 0.5, ground: 0.5 };
function decimate(P, tris, lock, reg, target) {
  const nv = P.length / 3;
  const nf = tris.length / 3;
  const F = Int32Array.from(tris);
  const alive = new Uint8Array(nf).fill(1);
  let live = nf;
  const vf = Array.from({ length: nv }, () => []);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vf[F[f * 3 + k]].push(f);
  const dead = new Uint8Array(nv);
  const d2 = (a, b) => (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;
  const fn = (f, sub, mx, my, mz, out) => {
    const p = [0, 1, 2].map((k) => {
      const v = F[f * 3 + k];
      return v === sub ? [mx, my, mz] : [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
    });
    const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2];
    const vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
    out[0] = uy * vz - uz * vy;
    out[1] = uz * vx - ux * vz;
    out[2] = ux * vy - uy * vx;
    const l = Math.hypot(out[0], out[1], out[2]);
    if (l > 0) (out[0] /= l), (out[1] /= l), (out[2] /= l);
    return l;
  };
  const n0 = [0, 0, 0], n1 = [0, 0, 0];
  const hasV = (f, v) => F[f * 3] === v || F[f * 3 + 1] === v || F[f * 3 + 2] === v;
  for (const maxL of [0.012, 0.016, 0.02, 0.024, 0.028, 0.033, 0.04]) {
    if (live <= target) break;
    const edges = [];
    for (let f = 0; f < nf; f++) {
      if (!alive[f]) continue;
      for (let k = 0; k < 3; k++) {
        const a = F[f * 3 + k], b = F[f * 3 + ((k + 1) % 3)];
        if (a < b && !lock[a] && !lock[b] && reg[a] === reg[b]) {
          const l = d2(a, b);
          if (l < maxL * maxL) edges.push(l, a, b);
        }
      }
    }
    const order = [];
    for (let i = 0; i < edges.length; i += 3) order.push(i);
    order.sort((x, y) => edges[x] - edges[y]);
    for (const i of order) {
      if (live <= target) break;
      const a = edges[i + 1], b = edges[i + 2];
      if (dead[a] || dead[b]) continue;
      const fa = vf[a].filter((f) => alive[f]);
      const fb = vf[b].filter((f) => alive[f]);
      const shared = fb.filter((f) => hasV(f, a));
      if (shared.length !== 2) continue;
      const na = new Set();
      fa.forEach((f) => [0, 1, 2].forEach((k) => na.add(F[f * 3 + k])));
      const nb = new Set();
      fb.forEach((f) => [0, 1, 2].forEach((k) => nb.add(F[f * 3 + k])));
      let common = 0;
      for (const x of nb) if (x !== a && x !== b && na.has(x)) common++;
      if (common !== 2) continue;
      const mx = (P[a * 3] + P[b * 3]) / 2, my = (P[a * 3 + 1] + P[b * 3 + 1]) / 2, mz = (P[a * 3 + 2] + P[b * 3 + 2]) / 2;
      let ok = true;
      for (const [list, v] of [[fa, a], [fb, b]]) {
        for (const f of list) {
          if (shared.includes(f)) continue;
          fn(f, -1, 0, 0, 0, n0);
          const l = fn(f, v, mx, my, mz, n1);
          if (l < 1e-9 || n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < 0.6) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
      if (!ok) continue;
      P[a * 3] = mx;
      P[a * 3 + 1] = my;
      P[a * 3 + 2] = mz;
      for (const f of shared) {
        alive[f] = 0;
        live--;
      }
      for (const f of fb) {
        if (!alive[f]) continue;
        for (let k = 0; k < 3; k++) if (F[f * 3 + k] === b) F[f * 3 + k] = a;
        vf[a].push(f);
      }
      dead[b] = 1;
    }
  }
  const out = [];
  for (let f = 0; f < nf; f++) if (alive[f]) out.push(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]);
  return out;
}

// Eyes and brows join the body mesh: one texture atlas (skin 1024 on top,
// eye and brow strips below), the parts told apart by a vertex attribute.
const ATLAS_V = 0.8;
function headParts(T) {
  const W = 1024, H = 1280;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return c;
  };
  const col = mk(), nor = mk();
  const g1 = col.getContext('2d'), g2 = nor.getContext('2d');
  g1.fillStyle = '#c8c8c8';
  g1.fillRect(0, 0, W, H);
  g1.drawImage(T.body.material.map.image, 0, 0, 1024, 1024);
  g1.drawImage(T.eyes.material.map.image, 0, 1024, 256, 256);
  if (T.brows.material.map) g1.drawImage(T.brows.material.map.image, 256, 1024, 256, 256);
  g2.fillStyle = 'rgb(128,128,255)';
  g2.fillRect(0, 0, W, H);
  if (T.body.material.normalMap) g2.drawImage(T.body.material.normalMap.image, 0, 0, 1024, 1024);
  if (T.brows.material.normalMap) g2.drawImage(T.brows.material.normalMap.image, 256, 1024, 256, 256);
  const tc = new THREE.CanvasTexture(col);
  tc.colorSpace = THREE.SRGBColorSpace;
  tc.flipY = false;
  tc.anisotropy = 4;
  const tn = new THREE.CanvasTexture(nor);
  tn.flipY = false;
  tn.anisotropy = 4;
  T.atlas = { map: keep(tc), normalMap: keep(tn) };
  const names = T.body.skeleton.bones.map((b) => b.name);
  const boneIdx = {};
  names.forEach((nm, i) => (boneIdx[nm] = i));
  const inv = new THREE.Matrix4().copy(T.body.bindMatrix).invert();
  const part = (mesh, u0) => {
    const g = mesh.geometry;
    const n = g.attributes.position.count;
    const M = inv.clone().multiply(mesh.bindMatrix);
    const Nm = new THREE.Matrix3().getNormalMatrix(M);
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const v = new THREE.Vector3();
    const map = mesh.skeleton.bones.map((b) => boneIdx[b.name] || 0);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(g.attributes.position, i).applyMatrix4(M).toArray(pos, i * 3);
      v.fromBufferAttribute(g.attributes.normal, i).applyMatrix3(Nm).normalize().toArray(nrm, i * 3);
      uv[i * 2] = u0 + clamp(g.attributes.uv.getX(i), 0, 1) * 0.25;
      uv[i * 2 + 1] = ATLAS_V + clamp(g.attributes.uv.getY(i), 0, 1) * (1 - ATLAS_V);
      for (let k = 0; k < 4; k++) {
        si[i * 4 + k] = map[g.attributes.skinIndex.getComponent(i, k)];
        sw[i * 4 + k] = g.attributes.skinWeight.getComponent(i, k);
      }
    }
    const morph = {};
    (g.morphAttributes.position || []).forEach((a) => (morph[a.name] = a.array));
    return { n, pos, nrm, uv, si, sw, idx: Array.from(g.index.array), morph };
  };
  T.parts = { eyes: part(T.eyes, 0), brows: part(T.brows, 0.25) };
  const bg = T.body.geometry;
  const nb = bg.attributes.position.count;
  const buv = new Float32Array(nb * 2);
  for (let i = 0; i < nb; i++) {
    buv[i * 2] = bg.attributes.uv.getX(i);
    buv[i * 2 + 1] = bg.attributes.uv.getY(i) * ATLAS_V;
  }
  T.bodyUV = buv;
  T.bodyMorph = {};
  (bg.morphAttributes.position || []).forEach((a) => (T.bodyMorph[a.name] = a.array));
  T.eyes.parent.remove(T.eyes);
  T.brows.parent.remove(T.brows);
  T.merged = {};
}

// The whole character body as one skinned geometry: skin (part 0), eyes (1),
// brows (2) and clothes (3). Cached per body + outfit + headwear.
function mergedGeometry(T, look, scalpHidden) {
  const key = [look.outfit, look.headwear, look.gloves ? 1 : 0, scalpHidden ? 1 : 0].join('|');
  if (T.merged[key]) return T.merged[key];
  const G = garment(T, look.outfit, look.headwear, look.gloves);
  const bg = T.body.geometry;
  const nb = bg.attributes.position.count;
  const E = T.parts.eyes, R = T.parts.brows, Cl = G.cloth;
  const nc = Cl.pos.length / 3;
  const N = nb + E.n + R.n + nc;
  const pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), uv = new Float32Array(N * 2);
  const si = new Uint16Array(N * 4), sw = new Float32Array(N * 4), part = new Float32Array(N), greg = new Float32Array(N);
  const v = new THREE.Vector3();
  for (let i = 0; i < nb; i++) {
    v.fromBufferAttribute(bg.attributes.position, i).toArray(pos, i * 3);
    v.fromBufferAttribute(bg.attributes.normal, i).toArray(nrm, i * 3);
    for (let k = 0; k < 4; k++) {
      si[i * 4 + k] = bg.attributes.skinIndex.getComponent(i, k);
      sw[i * 4 + k] = bg.attributes.skinWeight.getComponent(i, k);
    }
  }
  uv.set(T.bodyUV, 0);
  let o = nb;
  for (const [p, id] of [[E, 1], [R, 2]]) {
    pos.set(p.pos, o * 3);
    nrm.set(p.nrm, o * 3);
    uv.set(p.uv, o * 2);
    si.set(p.si, o * 4);
    sw.set(p.sw, o * 4);
    part.fill(id, o, o + p.n);
    o += p.n;
  }
  const oc = o;
  pos.set(Cl.pos, oc * 3);
  si.set(Cl.sIdx, oc * 4);
  sw.set(Cl.sWt, oc * 4);
  part.fill(3, oc, oc + nc);
  greg.set(Cl.reg, oc);
  // Cloth normals from its own (welded) faces: smooth.
  const ct = Cl.tris;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < ct.length; t += 3) {
    const i0 = oc + ct[t], i1 = oc + ct[t + 1], i2 = oc + ct[t + 2];
    a.fromArray(pos, i0 * 3);
    b.fromArray(pos, i1 * 3).sub(a);
    c.fromArray(pos, i2 * 3).sub(a);
    b.cross(c);
    for (const i of [i0, i1, i2]) {
      nrm[i * 3] += b.x;
      nrm[i * 3 + 1] += b.y;
      nrm[i * 3 + 2] += b.z;
    }
  }
  for (let i = oc; i < N; i++) {
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
    nrm[i * 3] /= l;
    nrm[i * 3 + 1] /= l;
    nrm[i * 3 + 2] /= l;
    uv[i * 2] = 0.75;
    uv[i * 2 + 1] = 0.95;
  }
  // Index: body (minus the scalp under hair), eyes, brows, cloth.
  const idx = [];
  const P = T.P, grp = T.grp;
  const top = T.eye.y + 0.075;
  const bt = G.bodyTris;
  for (let t = 0; t < bt.length; t += 3) {
    const i0 = bt[t], i1 = bt[t + 1], i2 = bt[t + 2];
    if (scalpHidden && grp[i0] === G_HEAD && grp[i1] === G_HEAD && grp[i2] === G_HEAD && P[i0 * 3 + 1] > top && P[i1 * 3 + 1] > top && P[i2 * 3 + 1] > top) continue;
    idx.push(i0, i1, i2);
  }
  E.idx.forEach((i) => idx.push(i + nb));
  R.idx.forEach((i) => idx.push(i + nb + E.n));
  ct.forEach((i) => idx.push(i + oc));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setAttribute('part', new THREE.BufferAttribute(part, 1));
  g.setAttribute('garReg', new THREE.BufferAttribute(greg, 1));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  g.morphAttributes.position = MORPHS.map((k) => {
    const arr = new Float32Array(N * 3);
    if (T.bodyMorph[k]) arr.set(T.bodyMorph[k], 0);
    if (R.morph[k]) arr.set(R.morph[k], (nb + E.n) * 3);
    const at = new THREE.BufferAttribute(arr, 3);
    at.name = k;
    return at;
  });
  g.morphTargetsRelative = true;
  keep(g);
  const out = { geo: g, G, tris: idx.length / 3 };
  T.merged[key] = out;
  return out;
}

// One material for the whole body: textured skin, eyes and brows; the
// clothes coloured, seamed and bumped from their rest-pose position.
const BODY_VERT_PARS = /* glsl */ `
attribute float garReg;
attribute float part;
varying vec3 vRest;
varying float vReg;
varying float vPart;
`;
const BODY_FRAG_PARS = /* glsl */ `
varying vec3 vRest;
varying float vReg;
varying float vPart;
uniform vec3 uTop, uBottom, uShoe, uGlove, uAccent, uTrim, uPatch, uScarf, uCap, uSkin, uBrow, uSkinSheen;
uniform float uOutfit; // 0 flight, 1 launch, 2 ground
uniform float uWaist, uSleeve, uWrist, uNeck, uShoeY, uKnee, uChest, uShX, uShY, uArmZ, uHip, uLegX, uEyeY, uEyeFront, uGloves, uFem;
float gBand(float x, float a, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + fwidth(x) * 1.5, abs(x - a)); }
float gBox(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; float e = max(d.x, d.y); return 1.0 - smoothstep(0.0, fwidth(e) * 1.5, e); }
float gDisc(vec2 p, vec2 c, float r) { float e = length(p - c) - r; return 1.0 - smoothstep(0.0, fwidth(e) * 1.5, e); }
vec3 gPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = dFdx(surf_pos);
  vec3 vSigmaY = dFdy(surf_pos);
  vec3 R1 = cross(vSigmaY, surf_norm);
  vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;
const CLOTH_GLSL = /* glsl */ `
  vec3 p = vRest;
  float ax = abs(p.x);
  bool arm = ax > uShX + 0.02 && p.y > uChest - 0.12 && ax > 0.2;
  float fx = p.x / 0.066, fy = (p.y - (uEyeY - 0.03)) / 0.088;
  bool inFace = p.z > uEyeFront - 0.05 && fx * fx + fy * fy < 1.0;
  // Hems: the extra ring of triangles is cut exactly on the line.
  if (vReg > 4.5) {
    if (inFace || p.y < uEyeY - 0.07 || (p.y < uEyeY + 0.025 && p.z > uEyeFront - 0.075)) discard;
  } else if (vReg > 3.5) {
    if (inFace) discard;
  } else {
    if (uGloves < 0.5 && ax > uSleeve && p.y > uChest - 0.15) discard;
    // The collar is a ring around the neck: away from the neck axis the cut
    // climbs, so the shoulders and upper chest (at or above neck height on a
    // real trapezius) stay covered.
    float neckDist = length(vec2(p.x, p.z + 0.01));
    if (!(ax > 0.2 && p.y < uNeck - 0.03) && p.y > uNeck + 0.02 * smoothstep(-0.03, -0.07, p.z) + 0.8 * max(0.0, neckDist - 0.075)) discard;
  }
  gRough = 0.88;
  if (vReg > 4.5) {
    // Comms cap: dark, with a lighter crown panel.
    gCol = uCap;
    float crown = gBand(p.x, 0.0, 0.05);
    gCol = mix(gCol, vec3(0.7, 0.69, 0.66), crown * step(p.z, 0.09));
    gH += crown * 0.4;
    gRough = 0.7;
  } else if (vReg > 3.5) {
    // Headscarf: soft folds.
    gCol = uScarf;
    gH += sin(p.y * 160.0 + p.x * 40.0) * 0.25 + sin(atan(p.x, p.z) * 9.0 + p.y * 30.0) * 0.35;
    gRough = 0.92;
  } else {
    bool glove = ax > uWrist && arm;
    bool shoe = !arm && p.y < uShoeY;
    gCol = p.y > uWaist || arm ? uTop : uBottom;
    if (glove) {
      gCol = uGlove;
      gRough = 0.6;
      gH += sin(ax * 900.0) * 0.15;
    }
    if (shoe) {
      gCol = uShoe;
      gRough = 0.55;
      float sole = 1.0 - smoothstep(0.022, 0.026, p.y);
      gCol = mix(gCol, uOutfit > 1.5 ? vec3(0.1, 0.085, 0.07) : vec3(0.68, 0.68, 0.65), sole * (uOutfit < 0.5 ? 1.0 : 0.5));
      gH -= gBand(p.y, 0.024, 0.004);
      if (uOutfit > 0.5) gH += gBand(p.y, uShoeY - 0.012, 0.004) * 0.8;
      // Laces / tongue line.
      float lace = gBand(mod(p.y + 2.0, 0.012), 0.006, 0.003) * gBand(p.x, sign(p.x) * uLegX, 0.024) * step(0.04, p.z) * step(0.03, p.y);
      gCol = mix(gCol, gCol * 1.7, lace * (uOutfit < 0.5 ? 1.0 : 0.6));
      gH += lace * 0.4;
    }
    if (!glove && !shoe) {
      // Weave, side and shoulder seams.
      gH += (sin(p.x * 1300.0) * sin(p.y * 1300.0) + sin(p.z * 1300.0 + p.y * 900.0)) * 0.06;
      if (!arm) gH -= gBand(p.z, -0.02, 0.003) * 0.6 * step(abs(p.z), 0.2);
      if (arm) gH -= gBand(ax, uShX + 0.03, 0.003) * 0.6;
      if (arm) {
        // Cuffs.
        bool suit = uOutfit > 0.5 && uOutfit < 1.5;
        float cuff = uOutfit < 0.5 ? gBand(ax, uSleeve - 0.012, 0.02) : gBand(ax, uWrist - 0.018, 0.03);
        gCol = mix(gCol, suit ? uTrim : uTop * 0.75, cuff);
        if (suit) {
          gMetal = mix(gMetal, 0.8, cuff);
          gRough = mix(gRough, 0.35, cuff);
        }
        gH += cuff * 0.5;
        // Elbow folds.
        float elb = uShX + (uWrist - uShX) * 0.47;
        gH += sin((ax - uShX) * 220.0) * (1.0 - smoothstep(0.0, 0.07, abs(ax - elb))) * 0.5;
        // Shoulder patches on the outside of the upper arm (it is up in the
        // T-pose rest space): agency / mission patch left, accent flag right.
        vec2 pp = vec2(ax - (uShX + 0.085), p.z - uArmZ);
        float top = step(uShY + 0.015, p.y);
        if (p.x > 0.0) {
          float d = gDisc(pp, vec2(0.0), 0.027) * top;
          float ring = gBand(length(pp), 0.027, 0.004) * top;
          gCol = mix(gCol, suit ? vec3(0.72) : uPatch, d);
          gCol = mix(gCol, suit ? uAccent : vec3(0.75, 0.56, 0.18), ring);
          gH += d * 0.3;
        } else {
          float fl = gBox(pp, vec2(0.0), vec2(0.026, 0.017)) * top;
          gCol = mix(gCol, suit ? uAccent : mix(uTop, uAccent, 0.35), fl);
          gCol = mix(gCol, vec3(0.7), fl * gBand(pp.y, 0.0, 0.008));
        }
        if (uOutfit > 1.5) {
          // Reflective bands on the jacket sleeves.
          float rb = gBand(ax, uShX + (uWrist - uShX) * 0.62, 0.026);
          gCol = mix(gCol, uAccent, rb);
          gEmis = max(gEmis, rb);
          gRough = mix(gRough, 0.4, rb);
        }
      } else if (p.y > uWaist) {
        // Collar.
        float col = gBand(p.y, uNeck - 0.008, 0.02);
        if (uOutfit > 0.5 && uOutfit < 1.5) {
          // The suit's metal neck ring.
          gCol = mix(gCol, uTrim, col);
          gMetal = mix(gMetal, 0.8, col);
          gRough = mix(gRough, 0.35, col);
        } else gCol = mix(gCol, uTop * 0.7, col);
        gH += col * 0.6;
        float tagY = uShY - mix(0.065, 0.03, uFem);
        if (uOutfit < 0.5) {
          // Polo placket and buttons; a small name tag (right chest).
          float plk = gBox(p.xy, vec2(0.0, uNeck - 0.055), vec2(0.012, 0.05)) * step(0.0, p.z);
          gH += plk * 0.35;
          gCol = mix(gCol, uTop * 0.85, plk);
          float btn = (1.0 - smoothstep(0.003, 0.0045, length(vec2(p.x, mod(p.y - uNeck + 0.1, 0.03) - 0.015)))) * plk;
          gCol = mix(gCol, vec3(0.7), btn);
          float tag = gBox(p.xy, vec2(-0.085, tagY), vec2(0.032, 0.008)) * step(0.0, p.z);
          gCol = mix(gCol, vec3(0.62, 0.62, 0.6), tag);
          // Hem of the shirt over the belt.
          gH -= gBand(p.y, uWaist + 0.012, 0.004) * 0.8;
        } else if (uOutfit < 1.5) {
          // Launch suit: name tag, zip, panel seams.
          float tag = gBox(p.xy, vec2(-0.095, tagY), vec2(0.04, 0.012)) * step(0.0, p.z);
          gCol = mix(gCol, vec3(0.7, 0.7, 0.68), tag);
          float zip = gBand(p.x + (p.y - uChest) * 0.25, 0.02, 0.006) * step(0.0, p.z) * step(uWaist, p.y);
          gH += zip * 0.8;
          gCol = mix(gCol, gCol * 0.6, zip);
          gH -= gBand(p.y, uChest - 0.09, 0.004) * 0.8;
          gH -= gBand(ax, 0.1, 0.004) * step(0.0, p.z) * step(p.y, uChest - 0.09) * 0.7;
        } else {
          // Ground jacket: zip, chest pockets, reflective band.
          float zip = gBand(p.x, 0.0, 0.007) * step(0.0, p.z);
          gCol = mix(gCol, vec3(0.45), zip);
          gMetal = mix(gMetal, 0.7, zip);
          gH += zip * 0.6;
          float pk = gBox(vec2(ax, p.y), vec2(0.085, uChest + 0.03), vec2(0.04, 0.045)) * step(0.0, p.z) * (1.0 - uFem);
          gH += gBand(p.y, uChest + 0.07, 0.005) * pk * 1.2 + pk * 0.15;
          float rb = gBand(p.y, uChest - 0.085, 0.028) * (1.0 - zip);
          gCol = mix(gCol, uAccent, rb);
          gEmis = max(gEmis, rb);
          gRough = mix(gRough, 0.4, rb);
          gH -= gBand(p.y, uWaist + 0.02, 0.012) * 0.6;
        }
      } else {
        // Trousers: belt, pockets, knee folds.
        float belt = gBand(p.y, uWaist - 0.012, 0.03);
        if (uOutfit < 0.5 || uOutfit > 1.5) {
          gCol = mix(gCol, vec3(0.06, 0.055, 0.05), belt);
          gRough = mix(gRough, 0.5, belt);
          float buckle = gBox(p.xy, vec2(0.0, uWaist - 0.012), vec2(0.02, 0.014)) * step(0.0, p.z);
          gCol = mix(gCol, vec3(0.5), buckle);
          gMetal = mix(gMetal, 0.9, buckle);
          gRough = mix(gRough, 0.3, buckle);
          gH += belt * 0.5;
        } else {
          gH -= gBand(p.y, uWaist - 0.01, 0.004) * 0.8;
        }
        // Fly seam.
        gH -= gBand(p.x, 0.0, 0.003) * step(0.0, p.z) * step(uHip - 0.1, p.y) * 0.6;
        // Cargo / thigh pockets on the outer thigh.
        float py = uKnee + (uHip - uKnee) * 0.45;
        float pk = gBox(vec2(p.z, p.y), vec2(-0.005, py), vec2(0.06, 0.07)) * step(uLegX + 0.03, ax);
        gH += pk * 0.35 + gBand(p.y, py + 0.07, 0.005) * step(uLegX + 0.03, ax) * 0.9;
        if (uOutfit > 0.5 && uOutfit < 1.5) gCol = mix(gCol, gCol * 0.85, pk);
        // Folds: knees, and the trouser legs breaking over the shoes.
        gH += sin(p.y * 260.0) * (1.0 - smoothstep(0.0, 0.06, abs(p.y - uKnee))) * 0.45;
        gH += sin(p.y * 180.0 + p.x * 30.0) * (1.0 - smoothstep(0.0, 0.07, p.y - uShoeY)) * 0.5;
      }
    }
  }
`;
function bodyMaterial(look, MG, T) {
  const C = MG.G.cuts;
  const c = (h) => new THREE.Color(h);
  const skin = c(look.skin).multiplyScalar(0.82 / 0.578);
  const brow = c(look.hairColor);
  const hsl = {};
  brow.getHSL(hsl);
  brow.setHSL(hsl.h, hsl.s, Math.min(hsl.l, 0.28)).multiplyScalar(0.9 / 0.402);
  const sheen = c(look.skin).multiplyScalar(0.14).add(new THREE.Color(0.025, 0.005, 0.002));
  const U = {
    uTop: { value: c(look.colors.top) },
    uBottom: { value: c(look.colors.bottom) },
    uShoe: { value: c(look.colors.shoe) },
    uGlove: { value: c(look.colors.glove) },
    uAccent: { value: c(look.colors.accent) },
    uTrim: { value: c(look.colors.trim) },
    uPatch: { value: c(look.colors.patch) },
    uScarf: { value: c(look.colors.scarf) },
    uCap: { value: c(look.colors.cap) },
    uSkin: { value: skin },
    uBrow: { value: brow },
    uSkinSheen: { value: sheen },
    uOutfit: { value: look.outfit === 'flight' ? 0 : look.outfit === 'launch' ? 1 : 2 },
    uWaist: { value: C.waist },
    uSleeve: { value: C.sleeve },
    uWrist: { value: C.wrist },
    uNeck: { value: C.neck },
    uShoeY: { value: C.shoe },
    uKnee: { value: C.knee },
    uChest: { value: C.chest },
    uShX: { value: C.shX },
    uShY: { value: T.bind.upperarm_l.y },
    uArmZ: { value: T.bind.upperarm_l.z },
    uHip: { value: C.hip },
    uLegX: { value: C.legX },
    uEyeY: { value: T.eye.y },
    uEyeFront: { value: T.eye.front },
    uGloves: { value: look.gloves ? 1 : 0 },
    uFem: { value: look.body === 'f' ? 1 : 0 },
  };
  // Keep cloth albedo (sRGB colours) sane: nothing brighter than ~0.75 linear.
  for (const k of ['uTop', 'uBottom', 'uShoe', 'uGlove', 'uAccent', 'uTrim', 'uPatch', 'uScarf', 'uCap']) {
    const col = U[k].value;
    const m = Math.max(col.r, col.g, col.b);
    if (m > 0.72) col.multiplyScalar(0.72 / m);
  }
  const m = new THREE.MeshPhysicalMaterial({ map: T.atlas.map, normalMap: T.atlas.normalMap, roughness: 0.5, metalness: 0, sheen: 1, sheenRoughness: 0.45, sheenColor: 0xffffff });
  m.normalScale.set(0.85, 0.85);
  m.userData.uniforms = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + BODY_VERT_PARS).replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;\nvReg = garReg;\nvPart = part;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + BODY_FRAG_PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (vPart < 0.5) diffuseColor.rgb *= uSkin; else if (vPart > 1.5 && vPart < 2.5) diffuseColor.rgb *= uBrow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 gCol = diffuseColor.rgb;\nfloat gRough = vPart < 0.5 ? 0.5 : (vPart < 1.5 ? 0.05 : 0.85);\nfloat gMetal = 0.0;\nfloat gH = 0.0;\nfloat gEmis = 0.0;\nif (vPart > 2.5) {\n' + CLOTH_GLSL + '\n}\ndiffuseColor.rgb = gCol;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gMetal;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', 'if (vPart < 2.5) {\n#include <normal_fragment_maps>\n} else { vec2 dH = vec2(dFdx(gH), dFdy(gH)) * 0.0011; normal = gPerturb(-vViewPosition, normal, dH, faceDirection); }')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor = vPart < 0.5 ? uSkinSheen : (vPart > 2.5 ? gCol * 0.5 : vec3(0.0));\nmaterial.sheenRoughness = vPart > 2.5 ? 0.65 : 0.4;\n#endif')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += gCol * gEmis * 0.05;');
  };
  m.customProgramCacheKey = () => 'ek-body-3';
  return m;
}

// ---------- Hair ----------
const HAIR_FOR = {
  m: { short: 'Hair_SimpleParted', curly: 'Hair_Buzzed', bun: 'Hair_Buns', long: 'Hair_Long' },
  f: { short: 'Hair_BuzzedFemale', curly: 'Hair_BuzzedFemale', bun: 'Hair_Buns', long: 'Hair_Long' },
};
const HAIR_SRC_BODY = { Hair_SimpleParted: 'm', Hair_Buzzed: 'm', Hair_Beard: 'm', Hair_BuzzedFemale: 'f', Hair_Buns: 'f', Hair_Long: 'f' };
function hairMaterial(srcMat, color, curly) {
  const m = new THREE.MeshStandardMaterial({ map: srcMat.map, normalMap: srcMat.normalMap, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  m.color.set(color).multiplyScalar(0.9 / 0.402);
  m.color.r = Math.min(1, m.color.r);
  m.color.g = Math.min(1, m.color.g);
  m.color.b = Math.min(1, m.color.b);
  if (curly) {
    // Tight curls: a bumpy, matte surface.
    m.roughness = 0.85;
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHp = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHp;\nvec3 hPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) { vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos); vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX); float fDet = dot(vSigmaX, R1) * faceDir; vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2); return normalize(abs(fDet) * surf_norm - vGrad); }\n')
        .replace('#include <map_fragment>', '#include <map_fragment>\nfloat hc = sin(vHp.x * 700.0 + sin(vHp.y * 500.0) * 2.0) * sin(vHp.y * 700.0 + sin(vHp.z * 520.0) * 2.0) * sin(vHp.z * 680.0 + sin(vHp.x * 480.0) * 2.0);\ndiffuseColor.rgb *= 0.82 + 0.3 * hc;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec2 dH = vec2(dFdx(hc), dFdy(hc)) * 0.0016; normal = hPerturb(-vViewPosition, normal, dH, faceDirection); }');
    };
    m.customProgramCacheKey = () => 'ek-hair-curly';
  }
  return m;
}

// ---------- Helmet (Orion crew survival suit style) ----------
const helmetGeos = new Map();
function helmetGeometry(R) {
  if (helmetGeos.has(R)) return helmetGeos.get(R);
  let helmetGeo;
  const parts = [];
  const add = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const w = 1.05; // half-width of the visor opening (radians round +Z)
  const t1 = 0.3 * Math.PI, t2 = 0.68 * Math.PI, tb = 0.78 * Math.PI;
  const f = Math.PI / 2 - w;
  add(new THREE.SphereGeometry(R, 28, 16, Math.PI / 2 + w, TAU - 2 * w, 0, tb));
  add(new THREE.SphereGeometry(R, 12, 8, f, 2 * w, 0, t1));
  add(new THREE.SphereGeometry(R, 12, 4, f, 2 * w, t2, tb - t2));
  // Visor frame and the neck ring.
  add(new THREE.TorusGeometry(R * 0.66, 0.008, 6, 28, Math.PI * 0.95), 0, R * 0.05, R * 0.77, 0, 0, Math.PI * 0.025);
  const ringY = Math.cos(tb) * R;
  add(new THREE.CylinderGeometry(R * 0.66, R * 0.7, 0.05, 28, 1, true), 0, ringY - 0.02, -0.005);
  add(new THREE.TorusGeometry(R * 0.7, 0.012, 6, 28), 0, ringY - 0.045, -0.005, Math.PI / 2);
  // Side lamps and comms bumps.
  [-1, 1].forEach((s) => {
    add(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10), s * (R + 0.006), 0.0, -0.01, 0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(0.022, 0.02, 0.05), s * (R - 0.01), R * 0.42, R * 0.4);
  });
  // A ridge over the top.
  add(new THREE.BoxGeometry(0.03, 0.012, R * 1.4), 0, R + 0.002, -R * 0.15);
  const merged = mergeSimple(parts);
  const visor = new THREE.SphereGeometry(R * 1.008, 20, 10, f - 0.03, 2 * w + 0.06, t1 - 0.03, t2 - t1 + 0.06);
  helmetGeo = { R, shell: keep(merged), visor: keep(visor) };
  helmetGeos.set(R, helmetGeo);
  return helmetGeo;
}
function mergeSimple(geos) {
  let n = 0;
  geos.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  geos.forEach((g) => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

let blobTex = null;
function blob() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)');
  gr.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  blobTex = keep(new THREE.CanvasTexture(c));
  return blobTex;
}

// ---------- Expressions ----------
const EXPR = {
  neutral: { smile: 0.12 },
  smile: { smile: 0.42, squint: 0.2 },
  happy: { smile: 0.8, browUp: 0.25, squint: 0.45 },
  joy: { smile: 1, browUp: 0.55, squint: 0.8, open: 0.55, blink: 0.25 },
  sad: { browSad: 1, frown: 0.9, blink: 0.18 },
  wow: { browUp: 1, open: 1 },
  scared: { browUp: 0.7, browSad: 0.6, open: 0.45 },
  tense: { browAngry: 0.55, frown: 0.35, squint: 0.3 },
  angry: { browAngry: 1, frown: 0.6, squint: 0.5 },
  focus: { browAngry: 0.35, squint: 0.35 },
  pain: { browSad: 0.6, browAngry: 0.4, squint: 0.9, blink: 0.5, open: 0.3 },
  tired: { blink: 0.45, browSad: 0.3, frown: 0.2 },
  calm: { smile: 0.2 },
};

// ---------- One character ----------
// Joint proxies: old code (capsule.js poses, director.js, storystage moods)
// writes rotations onto astro.joints after update(). Here those objects are
// proxies under the bones: what is written is read back on the next update
// (sit / rest patterns become the sit / rest poses, other values are added
// to the bones as offsets), then cleared, so the skeleton is never wrecked.
const REST_OLD = { shL: [0.04, 0.13], shR: [0.04, -0.13], elL: [-0.22, 0], elR: [-0.22, 0], hipL: [0, 0.02], hipR: [0, -0.02], knL: [0.04, 0], knR: [0.04, 0], ftL: [-0.04, 0], ftR: [-0.04, 0] };
const PROXY_BONE = { hips: 'pelvis', torso: 'spine_02', neck: 'neck_01', head: 'Head', shL: 'upperarm_l', shR: 'upperarm_r', elL: 'lowerarm_l', elR: 'lowerarm_r', hipL: 'thigh_l', hipR: 'thigh_r', knL: 'calf_l', knR: 'calf_r', ftL: 'foot_l', ftR: 'foot_r' };

// Procedural actions on top of a base clip (arms by two-bone IK, the rest
// by rotations in the character's own axes). fn(u, t, P) fills P.
const PROC = {
  wave: { dur: 2.4, expr: 'happy', base: 'idle', fn(u, t, P) {
    P.armR = { to: [-0.17, 0.5, 0.12], pole: [-1, -0.7, -0.3], sway: [Math.sin(t * 10) * 0.09, Math.abs(Math.cos(t * 10)) * -0.02, 0] };
    P.head = [0, -0.12, -0.1];
    P.spine = [0, 0, -0.04];
  } },
  salute: { dur: 2.0, expr: 'smile', base: 'idle', fn(u, t, P) {
    P.armR = { to: [-0.02, 0.22, 0.2], pole: [-1, 0.1, 0.1], rel: 'head' };
  } },
  cheer: { dur: 1.4, expr: 'happy', base: 'idle', fn(u, t, P) {
    const pump = Math.abs(Math.sin(u * Math.PI * 3));
    P.armR = { to: [-0.08, 0.28 + 0.16 * pump, 0.18], pole: [-1, -0.4, 0] };
    P.head = [-0.08, -0.1, 0];
    P.spine = [0, -0.08, 0];
  } },
  celebrate: { dur: 1.8, expr: 'joy', base: 'idle', fn(u, t, P) {
    const crouch = u < 0.2 ? smooth(u / 0.2) : u < 0.28 ? 1 - smooth((u - 0.2) / 0.08) : u > 0.7 && u < 0.86 ? Math.sin(((u - 0.7) / 0.16) * Math.PI) * 0.6 : 0;
    const lift = u > 0.24 && u < 0.72 ? Math.sin(((u - 0.24) / 0.48) * Math.PI) : 0;
    const up = u < 0.22 ? 0 : u < 0.32 ? smooth((u - 0.22) / 0.1) : u < 0.82 ? 1 : 1 - smooth((u - 0.82) / 0.18);
    P.legs = { crouch, tuck: lift * 0.6 };
    P.root = [0, 0.2 * lift - 0.08 * crouch, 0];
    P.armL = { to: [0.12, 0.62, 0.06], pole: [1, 0, -0.5], w: up };
    P.armR = { to: [-0.12, 0.62, 0.06], pole: [-1, 0, -0.5], w: up };
    P.head = [-0.28 * up, 0, 0];
  } },
  sad: { dur: 3.4, fadeIn: 0.7, expr: 'sad', base: 'idle', rate: 0.6, fn(u, t, P) {
    P.head = [0.48 + Math.sin(t * 0.8) * 0.03, 0.06, 0];
    P.neck = [0.12, 0, 0];
    P.spine = [0.12, 0, 0];
    P.shoulders = -0.025;
  } },
  tense: { dur: 1.6, expr: 'tense', base: 'idle', rate: 0.35, fn(u, t, P) {
    P.spine = [0.06, 0, 0];
    P.head = [0.08, 0, 0];
    P.shoulders = 0.03;
    P.armL = { to: [0.1, -0.33, 0.2], pole: [1, -0.3, -0.6], w: 0.6 };
    P.armR = { to: [-0.1, -0.33, 0.2], pole: [-1, -0.3, -0.6], w: 0.6 };
  } },
  brace: { dur: 1.8, expr: 'scared', base: 'crouch', fn(u, t, P) {
    P.armL = { to: [0.06, 0.12, 0.26], pole: [1, -0.8, -0.2], rel: 'head' };
    P.armR = { to: [-0.06, 0.12, 0.26], pole: [-1, -0.8, -0.2], rel: 'head' };
    P.head = [0.3, 0, 0];
    P.shake = 0.01;
  } },
  lookAround: { dur: 3.2, base: 'idle', fn(u, t, P) {
    P.head = [Math.sin(u * TAU) * 0.08, Math.sin(u * TAU) * 0.85, 0];
    P.spine = [0, Math.sin(u * TAU) * 0.2, 0];
  } },
  point: { dur: 1.8, base: 'idle', expr: 'focus', fn(u, t, P) {
    P.armR = { to: [-0.12, 0.08, 0.62], pole: [-1, -0.4, 0] };
    P.head = [0, -0.12, 0];
  } },
  reach: { dur: 1.6, base: 'idle', expr: 'focus', fn(u, t, P) {
    P.armR = { to: [-0.06, 0.12, 0.6], pole: [-1, -0.5, 0] };
    P.spine = [0.06, 0, 0];
  } },
  nod: { dur: 1.2, base: 'idle', expr: 'smile', fn(u, t, P) {
    P.head = [Math.sin(u * Math.PI * 3) * 0.22 * (1 - u), 0, 0];
  } },
  shake: { dur: 1.3, base: 'idle', fn(u, t, P) {
    P.head = [0.05, Math.sin(u * Math.PI * 4) * 0.35 * (1 - u * 0.7), 0];
  } },
  hop: { dur: 0.62, fadeIn: 0.05, base: null, fn(u, t, P) {
    let crouch = 0;
    let lift = 0;
    if (u < 0.16) crouch = smooth(u / 0.16) * 0.8;
    else if (u < 0.24) crouch = 0.8 * (1 - smooth((u - 0.16) / 0.08));
    if (u >= 0.2 && u < 0.8) lift = Math.sin(((u - 0.2) / 0.6) * Math.PI);
    if (u >= 0.8) crouch = Math.sin(((u - 0.8) / 0.2) * Math.PI) * 0.5;
    P.legs = { crouch, tuck: lift * 0.5 };
    P.root = [0, 0.24 * lift - 0.07 * crouch, 0];
  } },
  // A relaxed supine pose in the body's own frame (callers rotate the group).
  rest: { dur: 3, base: 'idle', rate: 0.4, hold: true, fn(u, t, P) {
    P.armL = { to: [-0.1, -0.42, 0.17], pole: [1, -0.3, 0], w: 0.9 };
    P.armR = { to: [0.1, -0.4, 0.17], pole: [-1, -0.3, 0], w: 0.9 };
    P.legs = { crouch: 0.25, tuck: 0 };
    P.head = [-0.05, 0.25, 0];
  } },
};
PROC.lie = Object.assign({}, PROC.rest, { lie: true });

export function createRigged(appearance, opts = {}) {
  if (!LIB) throw new Error('characters not loaded');
  let ap = Object.assign({}, appearance || {});
  let look = resolveLook(ap, opts);
  const castShadow = opts.shadows !== false;
  const group = new THREE.Group();
  group.name = 'character';
  // Persistent joint proxies (props stay attached through rebuilds).
  const joints = {};
  const aligns = {};
  for (const k of Object.keys(PROXY_BONE).concat(['handL', 'handR'])) {
    aligns[k] = new THREE.Group();
    aligns[k].name = 'align:' + k;
    joints[k] = new THREE.Group();
    joints[k].name = 'joint:' + k;
    aligns[k].add(joints[k]);
  }
  joints.helmet = new THREE.Group();
  joints.helmet.name = 'joint:helmet';

  let M = null; // the built model
  let mixer = null;
  let disposed = false;
  let envMap = opts.env !== undefined ? opts.env : null;
  if (opts.env === undefined) {
    import('./engine.js').then((e) => e.studioEnv && e.studioEnv().then((env) => {
      envMap = env;
      if (M && !disposed) applyEnv();
    }), () => {});
  }

  let shadowBlob = null;
  if (opts.blob !== false) {
    shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: blob(), transparent: true, depthWrite: false, opacity: 0.8 }));
    shadowBlob.rotation.x = -Math.PI / 2;
    shadowBlob.position.y = 0.005;
    shadowBlob.renderOrder = 1;
    group.add(shadowBlob);
  }

  function applyEnv() {
    if (!M) return;
    [M.visorMat, M.shellMat].forEach((m) => {
      if (m && envMap) {
        m.envMap = envMap;
        m.needsUpdate = true;
      }
    });
  }

  function build() {
    const T = LIB.bodies[look.body];
    const old = M;
    const rig = cloneSkinned(T.scene);
    rig.name = 'rig';
    const m = { T, rig, bones: {}, mats: [] };
    rig.traverse((o) => {
      if (o.isBone) m.bones[o.name] = o;
      else if (o.isSkinnedMesh) m.body = o;
    });
    const s = look.height / T.top;
    m.scale = s;
    rig.scale.setScalar(s);
    // One skinned mesh, one material: skin, eyes, brows and clothes.
    const scalpHidden = look.headwear === 'none' && !!HAIR_FOR[look.body][look.hair];
    const MG = mergedGeometry(T, look, scalpHidden);
    m.G = MG.G;
    const mat = bodyMaterial(look, MG, T);
    m.body.geometry = MG.geo;
    m.body.material = mat;
    m.body.updateMorphTargets();
    m.mats.push(mat);
    m.eyeMat = mat;
    // Hair.
    const helmetOn = look.helmet;
    const hairName = look.headwear === 'none' && HAIR_FOR[look.body][look.hair];
    const head = m.bones.Head;
    m.hairMeshes = [];
    const addHair = (name, curly, scale) => {
      const src = LIB.hairs[name];
      if (!src) return;
      const mat = hairMaterial(src.material, look.hairColor, curly);
      m.mats.push(mat);
      const h = new THREE.Mesh(src.geometry, mat);
      h.name = name;
      h.scale.setScalar((scale || 1) * (T.headScale || 1));
      if (HAIR_SRC_BODY[name] !== look.body) {
        // Fit a hairstyle made for the other head.
        h.scale.multiplyScalar(look.body === 'f' ? 0.97 : 1.03);
      }
      h.castShadow = castShadow;
      head.add(h);
      m.hairMeshes.push(h);
    };
    if (hairName) addHair(hairName, look.hair === 'curly', look.hair === 'curly' ? (look.body === 'f' ? 1.13 : 1.045) : 1);
    if (look.beard === 'full' && look.body === 'm' && !helmetOn) addHair('Hair_Beard', false, 1);
    // Helmet.
    if (helmetOn) {
      const hb = T.headBox;
      const R = Math.max(hb.max.x - hb.min.x, hb.max.y - hb.min.y, hb.max.z - hb.min.z) * 0.5 + 0.05;
      const hg = helmetGeometry(+R.toFixed(3));
      const hgrp = new THREE.Group();
      hgrp.name = 'helmet';
      const center = new THREE.Vector3((hb.max.x + hb.min.x) / 2, (hb.max.y + hb.min.y) / 2 + 0.012, (hb.max.z + hb.min.z) / 2 + 0.012);
      const al = new THREE.Matrix4().copy(T.bones.Head.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));
      al.decompose(hgrp.position, hgrp.quaternion, hgrp.scale);
      m.shellMat = new THREE.MeshStandardMaterial({ color: 0xc9cbc6, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide });
      // Inside of the shell: dark padding (no extra mesh).
      m.shellMat.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = vec3(0.035, 0.038, 0.042);');
      };
      m.shellMat.customProgramCacheKey = () => 'ek-shell';
      m.visorMat = look.visor === 'gold' ? new THREE.MeshStandardMaterial({ color: 0xb8892e, roughness: 0.16, metalness: 0.9, envMapIntensity: 1.0 }) : new THREE.MeshStandardMaterial({ color: 0x9fb4c0, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 0.8 });
      m.mats.push(m.shellMat, m.visorMat);
      const shell = new THREE.Mesh(hg.shell, m.shellMat);
      shell.castShadow = castShadow;
      const visor = new THREE.Mesh(hg.visor, m.visorMat);
      visor.renderOrder = 3;
      hgrp.add(shell, visor);
      head.add(hgrp);
      hgrp.add(joints.helmet);
      m.helmet = hgrp;
    } else {
      // The helmet joint still exists (props): at the head.
      aligns.head.add(joints.helmet);
    }
    // Joint proxies under the new bones.
    for (const k in aligns) {
      const a = T.align[k];
      if (!a) continue;
      aligns[k].position.copy(a.pos);
      aligns[k].quaternion.copy(a.q);
      m.bones[a.bone].add(aligns[k]);
    }
    // Shadows, culling, visibility tracking.
    const sphere = new THREE.Sphere(new THREE.Vector3(0, T.top * 0.5, 0), T.top * 0.85);
    [m.body].forEach((o) => {
      o.castShadow = castShadow;
      o.receiveShadow = false;
      o.boundingSphere = sphere.clone();
      o.frustumCulled = true;
    });
    m.body.onBeforeRender = () => (seenFrame = frameNo);
    rig.position.y = 0.006;
    // Finger rest (the bind pose: open hand) for the relaxed-hands layer.
    m.fingers = [];
    for (const k in m.bones) if (/^(index|middle|ring|pinky|thumb)_0[123]_/.test(k)) m.fingers.push([m.bones[k], T.bones[k].quaternion.clone()]);
    // Mixer.
    const mx = new THREE.AnimationMixer(rig);
    m.actions = {};
    m.mixer = mx;
    M = m;
    group.add(rig);
    if (old) {
      group.remove(old.rig);
      old.mixer.stopAllAction();
      old.mixer.uncacheRoot(old.rig);
      old.mats.forEach((x) => x.dispose());
    }
    mixer = mx;
    weights = {};
    applyEnv();
    seenFrame = -100;
    forceFrames = 3;
  }

  function action(name) {
    let a = M.actions[name];
    if (a) return a;
    const clip = M.T.clips[name];
    if (!clip) return null;
    a = mixer.clipAction(clip);
    const spec = CLIPS[name] && CLIPS[name][1];
    if (spec && (spec.once || spec.clamp)) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    a.enabled = true;
    a.setEffectiveWeight(0);
    M.actions[name] = a;
    return a;
  }

  // ---------- State ----------
  let speedTarget = 0, speed = 0, speedPrev = 0, accelS = 0;
  let leanTarget = 0, leanNow = 0;
  let floatTarget = 0, floatK = 0, swim = 0;
  let carry = null; // { spread, w, want }
  let reachK = 0, reachNow = 0;
  let phase = 0;
  let onStep = opts.onStep || null;
  let time = Math.random() * 10;
  let frameNo = 0, seenFrame = -100, forceFrames = 3, pendingDt = 0;
  let blinkIn = 1.5 + Math.random() * 3, blinkT = -1;
  let act = null; // the current action
  let hold = null; // a held pose: { name, clip|proc }
  let lookTarget = null;
  const look2 = { yaw: 0, pitch: 0 };
  let exprOverride = null;
  const exprNow = {};
  MORPHS.forEach((k) => (exprNow[k] = 0));
  let weights = {};
  let share = { loco: 1, hold: 0, act: 0 };
  let classicSeat = 0; // frames the classic sit pattern was seen
  let classicRest = 0;
  const reduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fit = 0; // seat fit weight (0..1)
  let lieK = 0;

  build();

  // ---------- Play ----------
  function canon(name) {
    if (!name) return null;
    if (CLIPS[name] || PROC[name] || name === 'stand' || name === 'float' || name === 'carry') return name;
    const a = ALIAS[name] || ALIAS[String(name).toLowerCase()];
    if (a) return a;
    const low = String(name).toLowerCase();
    for (const k of Object.keys(CLIPS).concat(Object.keys(PROC))) if (k.toLowerCase() === low) return k;
    return null;
  }
  function play(name, o = {}) {
    if (disposed) return;
    const req = name;
    name = canon(name);
    if (name === 'carry') {
      const spread = o.spread != null ? o.spread : 0.3;
      carry = carry ? Object.assign(carry, { spread, want: 1 }) : { spread, w: 0, want: 1 };
      return;
    }
    if (name === 'float') {
      floatTarget = 1;
      return;
    }
    if (name === 'stand') {
      if (hold && (hold.name === 'sit' || hold.name === 'sitTalk' || hold.name === 'drive') && !o.instant) {
        hold = null;
        startAct('standUp', { onDone: o.onDone });
      } else {
        hold = null;
        if (o.onDone) setTimeout(o.onDone, 0);
      }
      return;
    }
    if (!name) {
      // Unknown: a short idle beat, so scripts never stall.
      act = { name: String(req), t: 0, dur: o.duration || 1, hold: false, beat: true, done: o.onDone || null, fadeIn: 0.2, fadeOut: 0.3, w: 0 };
      return;
    }
    const isLoopClip = CLIPS[name] && !(CLIPS[name][1] && CLIPS[name][1].once);
    const isSeat = CLIPS[name] && CLIPS[name][1] && CLIPS[name][1].seat;
    const P = PROC[name];
    // Held poses (sit, lie, rest, crouch, drive, torch ...): idempotent.
    if (o.hold && (isLoopClip || (P && P.hold) || name === 'lie' || name === 'rest' || name === 'fall')) {
      if (hold && hold.name === name) return;
      hold = { name, t: 0, proc: P || null, clip: CLIPS[name] ? name : P ? P.base : null, seat: !!isSeat, lie: name === 'lie' };
      if (name === 'fall') hold.clip = 'fall';
      if (CLIPS[name]) {
        const a = action(name);
        if (a && !(CLIPS[name][1] && CLIPS[name][1].once)) a.time = Math.random() * a.getClip().duration;
        if (a && name === 'fall') a.reset();
      }
      if (act && !act.over) act = null;
      return;
    }
    if (name === 'sit' || name === 'sitTalk' || name === 'drive' || name === 'lie' || name === 'rest' || name === 'crouch' || name === 'torch') {
      // Poses without hold still stay until stand / stopAction.
      return play(name, Object.assign({}, o, { hold: true }));
    }
    if (name === 'sitDown') {
      startAct('sitDown', { onDone: () => {
        hold = { name: 'sit', t: 0, clip: 'sit', seat: true };
        if (o.onDone) o.onDone();
      } });
      return;
    }
    startAct(name, o);
  }
  function startAct(name, o = {}) {
    const P = PROC[name];
    const clipName = CLIPS[name] ? name : null;
    const clip = clipName ? M.T.clips[clipName] : null;
    const natural = clip ? clip.duration : P ? P.dur : 1;
    const once = clipName && CLIPS[name][1] && CLIPS[name][1].once;
    let dur = o.duration || (once ? natural : P ? P.dur : Math.max(natural, 2.2));
    act = { name, t: 0, dur, hold: !!o.hold, proc: P || null, clip: clipName || (P ? P.base : null), done: o.onDone || null, expr: P ? P.expr : null, fadeIn: (P && P.fadeIn) || 0.22, fadeOut: 0.3, w: 0, rate: P && P.rate };
    if (clipName) {
      const a = action(clipName);
      a.reset();
      a.enabled = true;
      a.setEffectiveTimeScale(once && o.duration ? natural / o.duration : 1);
      a.play();
    }
  }
  function stopAction(name) {
    if (name === 'carry') {
      if (carry) carry.want = 0;
      return;
    }
    if (name === 'float') {
      floatTarget = 0;
      return;
    }
    if (act) act.stopping = true;
    if (!name || (hold && (name === hold.name || name === 'hold'))) hold = null;
  }

  // ---------- Bone helpers (world space) ----------
  const _v = [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector3());
  const _q = [0, 1, 2, 3, 4].map(() => new THREE.Quaternion());
  const AX = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  function charAxes() {
    group.updateWorldMatrix(true, false);
    const e = group.matrixWorld.elements;
    AX.x.set(e[0], e[1], e[2]).normalize();
    AX.y.set(e[4], e[5], e[6]).normalize();
    AX.z.set(e[8], e[9], e[10]).normalize();
  }
  function worldDelta(bone, dq) {
    const qw = _q[0], qp = _q[1];
    bone.getWorldQuaternion(qw);
    qw.premultiply(dq);
    bone.parent.getWorldQuaternion(qp).invert();
    bone.quaternion.copy(qp.multiply(qw));
    bone.updateMatrixWorld(true);
  }
  function rotAxis(bone, axis, angle) {
    if (!bone || Math.abs(angle) < 1e-5) return;
    worldDelta(bone, _q[2].setFromAxisAngle(axis, angle));
  }
  // Euler-ish [pitch, yaw, roll] in the character's axes (pitch + = forward/down).
  function rotChar(bone, e, w = 1) {
    if (!bone || !e) return;
    if (e[1]) rotAxis(bone, AX.y, e[1] * w);
    if (e[0]) rotAxis(bone, AX.x, e[0] * w);
    if (e[2]) rotAxis(bone, AX.z, e[2] * w);
  }
  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qs = new THREE.Quaternion();
  function ik2(a, b, c, target, pole, w) {
    if (w <= 0.002) return;
    _qa.copy(a.quaternion);
    _qb.copy(b.quaternion);
    const A = a.getWorldPosition(_v[0]);
    const B = b.getWorldPosition(_v[1]);
    const C = c.getWorldPosition(_v[2]);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const D = _v[3].subVectors(target, A);
    let d = D.length();
    D.normalize();
    d = clamp(d, Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.998);
    const Pv = _v[4].copy(pole).addScaledVector(D, -pole.dot(D));
    if (Pv.lengthSq() < 1e-8) Pv.subVectors(B, A).addScaledVector(D, -_v[5].subVectors(B, A).dot(D));
    Pv.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const Bd = _v[5].copy(A).addScaledVector(D, cosA * l1).addScaledVector(Pv, sinA * l1);
    const from = _v[6].subVectors(B, A).normalize();
    const to = _v[7].subVectors(Bd, A).normalize();
    worldDelta(a, _q[3].setFromUnitVectors(from, to));
    b.getWorldPosition(B);
    c.getWorldPosition(C);
    const Tt = _v[5].copy(A).addScaledVector(D, d);
    from.subVectors(C, B).normalize();
    to.subVectors(Tt, B).normalize();
    worldDelta(b, _q[3].setFromUnitVectors(from, to));
    if (w < 0.998) {
      _qs.copy(a.quaternion);
      a.quaternion.copy(_qa).slerp(_qs, w);
      _qs.copy(b.quaternion);
      b.quaternion.copy(_qb).slerp(_qs, w);
      a.updateMatrixWorld(true);
    }
  }
  const toWorld = (x, y, z, out) => out.set(x, y, z).applyMatrix4(group.matrixWorld);
  const charPos = (bone, out) => {
    bone.getWorldPosition(out);
    return out.applyMatrix4(_mInv);
  };
  const _mInv = new THREE.Matrix4();
  const _fq = new THREE.Quaternion();
  const _tgt = new THREE.Vector3(), _pole = new THREE.Vector3(), _sh = new THREE.Vector3();
  // Arm IK from a spec { to: [x,y,z] from the shoulder (or 'head'), pole, sway, w }.
  function armIK(side, spec, w) {
    if (!spec) return;
    const B = M.bones;
    const s = M.scale;
    const L = side === 'L';
    const ua = B[L ? 'upperarm_l' : 'upperarm_r'], la = B[L ? 'lowerarm_l' : 'lowerarm_r'], hd = B[L ? 'hand_l' : 'hand_r'];
    const ref = spec.rel === 'head' ? B.Head : ua;
    charPos(ref, _sh);
    const t = spec.to;
    const sw = spec.sway || [0, 0, 0];
    toWorld(_sh.x + (t[0] + sw[0]) * s, _sh.y + (t[1] + sw[1]) * s, _sh.z + (t[2] + sw[2]) * s, _tgt);
    const p = spec.pole;
    _pole.set(0, 0, 0).addScaledVector(AX.x, p[0]).addScaledVector(AX.y, p[1]).addScaledVector(AX.z, p[2]).normalize();
    ik2(ua, la, hd, _tgt, _pole, w * (spec.w == null ? 1 : spec.w));
  }
  function legsBend(spec, w) {
    if (!spec || w <= 0) return;
    const B = M.bones;
    const c = spec.crouch || 0, tk = spec.tuck || 0;
    for (const sd of ['l', 'r']) {
      rotAxis(B['thigh_' + sd], AX.x, -(0.55 * c + 0.45 * tk) * w);
      rotAxis(B['calf_' + sd], AX.x, (1.05 * c + 0.85 * tk) * w);
      rotAxis(B['foot_' + sd], AX.x, -(0.5 * c - 0.2 * tk) * w);
    }
    rotAxis(B.spine_01, AX.x, (0.2 * c) * w);
  }

  // ---------- Update ----------
  const P = {};
  function readProxies() {
    const r = {};
    let any = false;
    for (const k in PROXY_BONE) {
      const j = joints[k];
      const e = j.rotation;
      if (e.x || e.y || e.z) {
        r[k] = [e.x, e.y, e.z];
        any = true;
        e.set(0, 0, 0);
      }
    }
    return any ? r : null;
  }
  function update(dt) {
    if (disposed) return;
    dt = Math.min(dt || 0, 0.1);
    time += dt;
    frameNo++;
    const classic = readProxies();
    // Classic pose patterns (old code writing joint angles).
    if (classic && classic.hipL && classic.knL && classic.hipL[0] < -1.1 && classic.knL[0] > 0.9) classicSeat = 3;
    else if (classicSeat > 0) classicSeat--;
    if (classic && classic.hipL && classic.knL && classic.hipL[0] > -0.6 && classic.hipL[0] < -0.2 && classic.knL[0] > 0.4 && classic.knL[0] < 0.85 && classic.elL && classic.elL[0] < -1) classicRest = 3;
    else if (classicRest > 0) classicRest--;
    const classicPose = classicSeat > 0 ? 'sit' : classicRest > 0 ? 'rest' : null;
    if (classicPose && (!hold || hold.name !== classicPose)) play(classicPose, { hold: true });
    if (!classicPose && hold && hold.classic) hold = null;
    if (classicPose && hold) hold.classic = true;

    // Locomotion state.
    speed += (speedTarget - speed) * Math.min(1, dt * 8);
    if (speed < 0.003 && speedTarget === 0) speed = 0;
    const acc = dt > 0 ? (speed - speedPrev) / dt : 0;
    speedPrev = speed;
    accelS += (acc - accelS) * Math.min(1, dt * 8);
    leanNow += (leanTarget - leanNow) * Math.min(1, dt * 8);
    floatK += (floatTarget - floatK) * Math.min(1, dt * 2.5);
    reachNow += (reachK - reachNow) * Math.min(1, dt * 6);
    if (carry) {
      carry.w += (carry.want - carry.w) * Math.min(1, dt * 6);
      if (!carry.want && carry.w < 0.01) carry = null;
    }
    const T = M.T;
    const s = M.scale;
    const ground = 1 - floatK;
    const loco = T.loco;
    const sp = speed * ground;
    // Stride matching: a natural cadence for the speed, then the clip blend
    // whose stride gives that speed.
    const lw = { idle: 0, walk: 0, jog: 0, run: 0, sprint: 0 };
    let Lb = 1;
    if (sp < 0.04) lw.idle = 1;
    else {
      const ladder = ['walk', 'jog', 'run', 'sprint'];
      const Ls = ladder.map((k) => loco[k].L * s);
      const cad = clamp(0.62 + 0.21 * sp, 0.8, 1.5);
      const Lw = sp / cad;
      if (Lw <= Ls[0]) {
        const k = smooth(sp / (0.45 * s));
        lw.walk = k;
        lw.idle = 1 - k;
        Lb = Ls[0];
      } else {
        let i = 0;
        while (i < 2 && Lw > Ls[i + 1]) i++;
        const k = clamp((Lw - Ls[i]) / (Ls[i + 1] - Ls[i]), 0, 1);
        lw[ladder[i]] = 1 - k;
        lw[ladder[i + 1]] = k;
        Lb = lerp(Ls[i], Ls[i + 1], k);
      }
    }
    // Phase (shared by the moving clips) and foot landings.
    if (sp > 0.04) {
      const prev = phase;
      phase += (dt * sp) / Lb;
      let dom = 'walk', dw = 0;
      for (const k of ['walk', 'jog', 'run', 'sprint']) if (lw[k] > dw) (dw = lw[k]), (dom = k);
      const land = loco[dom].land;
      for (const l of land) {
        const a = Math.floor(prev - l), b = Math.floor(phase - l);
        if (b > a && onStep && sp > 0.35 && ground > 0.5 && !hold) onStep({ run: lw.run + lw.sprint + lw.jog > 0.5, speed: sp });
      }
    }
    // Shares: action over held pose over locomotion.
    if (act) {
      act.t += dt;
      const fin = !act.hold && act.t >= act.dur;
      if (act.stopping || fin) act.w -= dt / act.fadeOut;
      else act.w += dt / act.fadeIn;
      act.w = clamp(act.w, 0, 1);
      if ((act.stopping || fin) && act.w <= 0) {
        const done = act.done;
        act = null;
        if (done) done();
      }
    }
    if (hold) hold.t += dt;
    const actW = act ? smooth(act.w) : 0;
    const actClipW = act && act.clip && !act.beat ? actW : 0;
    const wantHold = hold ? 1 : 0;
    share.hold += (wantHold - share.hold) * Math.min(1, dt * 5);
    if (share.hold < 0.002 && !hold) share.hold = 0;
    // Clip weights.
    const W = {};
    const addW = (name, w) => {
      if (w > 0 && T.clips[name]) W[name] = (W[name] || 0) + w;
    };
    const locoShare = (1 - share.hold) * (1 - actClipW);
    for (const k in lw) addW(k === 'idle' ? 'idle' : k, lw[k] * locoShare);
    if (hold) addW(hold.clip || 'idle', share.hold * (1 - actClipW));
    else if (share.hold > 0 && lastHoldClip) addW(lastHoldClip, share.hold * (1 - actClipW));
    if (hold) lastHoldClip = hold.clip || 'idle';
    if (act && act.clip && !act.beat) addW(act.clip, actClipW);
    let sum = 0;
    for (const k in W) sum += W[k];
    if (sum < 1e-4) {
      W.idle = 1;
      sum = 1;
    }
    for (const k in W) W[k] /= sum;
    // Apply to actions.
    for (const k in M.actions) if (!(k in W)) {
      const a = M.actions[k];
      if (a.isRunning() || a.getEffectiveWeight() > 0) {
        a.setEffectiveWeight(0);
        a.stop();
      }
    }
    for (const k in W) {
      const a = action(k);
      if (!a) continue;
      if (!a.isRunning()) {
        a.enabled = true;
        a.play();
      }
      a.setEffectiveWeight(W[k]);
      if (loco[k]) {
        a.setEffectiveTimeScale(0);
        a.time = (((phase % 1) + 1) % 1) * a.getClip().duration;
      } else if (k === 'idle') a.setEffectiveTimeScale(hold && hold.proc && hold.proc.rate ? hold.proc.rate : act && act.rate ? act.rate : 1);
    }
    // Visible? (off-screen characters keep their clocks but skip the pose)
    const visible = forceFrames > 0 || frameNo - seenFrame < 20;
    if (forceFrames > 0) forceFrames--;
    pendingDt += dt;
    if (!visible) return;
    mixer.update(pendingDt);
    pendingDt = 0;
    // Relaxed hands: the clips clench fists; ease the fingers half open
    // unless the hands are holding something.
    {
      const grip = (hold && !['sit', 'sitTalk', 'rest', 'lie'].includes(hold.name) ? share.hold : 0) + actClipW + (carry ? carry.w : 0);
      const rw = 0.5 * clamp(1 - grip, 0, 1);
      if (rw > 0.01) for (const [b, q] of M.fingers) b.quaternion.slerp(q, rw);
    }

    // ---------- Procedural layers ----------
    const rig = M.rig;
    // Seat fit: pelvis to 0.47 m up and 0.12 m back from the seat anchor.
    const seatW = (hold && hold.seat) || (act && CLIPS[act.name] && CLIPS[act.name][1] && CLIPS[act.name][1].seat) ? 1 : 0;
    fit += (seatW - fit) * Math.min(1, dt * 6);
    lieK += ((hold && hold.lie ? 1 : 0) - lieK) * Math.min(1, dt * 4);
    rig.position.set(0, 0.006, 0);
    rig.rotation.set(0, 0, 0);
    // Root bounce from actions.
    for (const k in P) delete P[k];
    if (act && act.proc) act.proc.fn(clamp(act.t / act.dur, 0, 1), act.t, P);
    const holdP = {};
    if (hold && hold.proc) hold.proc.fn(0.5, hold.t, holdP);
    group.updateMatrixWorld(true);
    charAxes();
    _mInv.copy(group.matrixWorld).invert();
    if (P.root) rig.position.y += P.root[1] * s * actW;
    if (lieK > 0.001) {
      rig.rotation.x = -Math.PI / 2 * lieK;
      rig.position.y += 0.15 * s * lieK;
      rig.position.z += 0.05 * lieK;
    }
    rig.updateMatrixWorld(true);
    if (fit > 0.001) {
      const pel = charPos(M.bones.pelvis, _v[0]);
      const k = clamp((T.standPelvis * s - pel.y) / Math.max(0.05, (T.standPelvis - T.sitPelvis) * s), 0, 1) * fit;
      if (k > 0.001) {
        rig.position.y += (0.47 - pel.y) * k;
        rig.position.z += (-0.12 - pel.z) * k;
        rig.updateMatrixWorld(true);
        // Feet down to the floor, shins about vertical.
        for (const sd of ['l', 'r']) {
          const th = M.bones['thigh_' + sd], ca = M.bones['calf_' + sd], ft = M.bones['foot_' + sd];
          const fq = ft.getWorldQuaternion(new THREE.Quaternion());
          const hip = charPos(th, _v[1]);
          const l1 = charPos(ca, _v[2]).distanceTo(hip);
          const fx = charPos(ft, _v[3]).x;
          toWorld(fx, T.ankleY * s, hip.z + l1 * 0.9, _tgt);
          _pole.copy(AX.z).addScaledVector(AX.y, 0.3).normalize();
          ik2(th, ca, ft, _tgt, _pole, k);
          // Foot flat again.
          ft.parent.getWorldQuaternion(_q[4]).invert();
          ft.quaternion.slerp(_q[4].multiply(fq), k);
          ft.updateMatrixWorld(true);
        }
      }
    }
    const B = M.bones;
    // Relaxed stance: the idle's wide feet come in under the hips, knees
    // forward (the source idle is a wide "ready" stance).
    const idleW = lw.idle * locoShare * ground * (1 - fit) * (hold ? 0 : 1) * (1 - actW * 0.5);
    if (idleW > 0.01) {
      for (const sd of ['l', 'r']) {
        const th = B['thigh_' + sd], ca = B['calf_' + sd], ft = B['foot_' + sd];
        ft.getWorldQuaternion(_fq);
        const hx = charPos(th, _v[1]).x;
        const foot = charPos(ft, _v[2]);
        toWorld(lerp(foot.x, hx * 1.08, 0.9), foot.y, foot.z + 0.015 * s, _tgt);
        _pole.copy(AX.z).addScaledVector(AX.x, sd === 'l' ? 0.05 : -0.05).normalize();
        ik2(th, ca, ft, _tgt, _pole, idleW);
        ft.parent.getWorldQuaternion(_q[4]).invert();
        ft.quaternion.slerp(_q[4].multiply(_fq), idleW);
        ft.updateMatrixWorld(true);
      }
    }
    // Float in zero-g: neutral body posture, slow drift; swimming reaches.
    if (floatK > 0.001 && !hold) {
      const tt = reduced ? 0 : time;
      const f = floatK * (1 - actW * 0.6);
      rig.position.y += Math.sin(tt * 0.8) * 0.02 * floatK;
      rotAxis(B.thigh_l, AX.x, (-0.85 + Math.sin(tt * 0.6) * 0.07 + swim * 0.35) * f);
      rotAxis(B.thigh_r, AX.x, (-0.7 - Math.sin(tt * 0.6) * 0.07 + swim * 0.3) * f);
      rotAxis(B.thigh_l, AX.z, 0.08 * f);
      rotAxis(B.thigh_r, AX.z, -0.08 * f);
      rotAxis(B.calf_l, AX.x, (1.0 - swim * 0.4) * f);
      rotAxis(B.calf_r, AX.x, (0.85 - swim * 0.35) * f);
      rotAxis(B.foot_l, AX.x, 0.35 * f);
      rotAxis(B.foot_r, AX.x, 0.35 * f);
      rotAxis(B.spine_02, AX.x, 0.06 * f);
      rotAxis(B.Head, AX.x, -0.08 * f);
      const sw = swim * Math.sin(tt * 2.2);
      if (!carry || carry.w < 0.5) {
        armIK('L', { to: [0.14 + 0.05 * Math.sin(tt * 0.9), -0.16 + 0.3 * swim * (0.5 + 0.5 * sw), 0.24 + 0.25 * swim], pole: [1, -0.4, -0.6] }, f * (1 - (carry ? carry.w : 0)));
        armIK('R', { to: [-0.14 - 0.05 * Math.sin(tt * 0.9 + 1), -0.16 + 0.3 * swim * (0.5 - 0.5 * sw), 0.24 + 0.25 * swim], pole: [-1, -0.4, -0.6] }, f * (1 - (carry ? carry.w : 0)) * (1 - reachNow));
      }
    }
    // Held procedural pose (rest / lie).
    if (hold && hold.proc) {
      const hw = share.hold;
      if (holdP.legs) legsBend(holdP.legs, hw);
      armIK('L', holdP.armL, hw);
      armIK('R', holdP.armR, hw);
      rotChar(B.Head, holdP.head, hw);
    }
    // Action overlays.
    if (act && act.proc && actW > 0) {
      if (P.legs) legsBend(P.legs, actW);
      if (P.spine) rotChar(B.spine_02, P.spine, actW);
      if (P.neck) rotChar(B.neck_01, P.neck, actW);
      if (P.shoulders) {
        rotAxis(B.clavicle_l, AX.z, P.shoulders * 4 * actW);
        rotAxis(B.clavicle_r, AX.z, -P.shoulders * 4 * actW);
      }
      armIK('L', P.armL, actW);
      armIK('R', P.armR, actW);
      if (P.head) rotChar(B.Head, P.head, actW);
      if (P.shake && !reduced) rig.position.x += Math.sin(time * 40) * P.shake * actW;
    }
    // Carrying: hands round the part in front of the chest.
    if (carry && carry.w > 0.001) {
      const cw = carry.w * (1 - actW * 0.7);
      const x = 0.16 + carry.spread * 0.22;
      armIK('L', { to: [x - 0.19, -0.36, 0.34], pole: [0.6, -1, -0.2] }, cw);
      armIK('R', { to: [-x + 0.19, -0.36, 0.34], pole: [-0.6, -1, -0.2] }, cw);
      rotAxis(B.spine_02, AX.x, -0.05 * cw);
    }
    // Reach (survival: the right hand out for a handhold).
    if (reachNow > 0.01) armIK('R', { to: [-0.06, 0.1, 0.58], pole: [-1, -0.5, 0] }, reachNow);
    // Lean into turns, lean into starts.
    if (ground > 0 && !hold) {
      rotAxis(B.pelvis, AX.z, leanNow * 0.35 * ground);
      rotAxis(B.spine_01, AX.z, leanNow * 0.4 * ground);
      rotAxis(B.spine_01, AX.x, clamp(accelS * 0.025, -0.08, 0.12) * ground);
    }
    // Old-style joint writes: added as offsets in the character's axes.
    if (classic && !classicPose) {
      for (const k in classic) {
        const bone = B[PROXY_BONE[k]];
        const [x, y, z] = classic[k];
        const r = REST_OLD[k];
        const dx = x ? x - (r ? r[0] : 0) : 0;
        const dz = z ? z - (r ? r[1] : 0) : 0;
        if (dx) rotAxis(bone, AX.x, dx);
        if (y) rotAxis(bone, AX.y, y);
        if (dz) rotAxis(bone, AX.z, dz);
      }
    }
    // Look-at: neck and head (and a little chest), clamped, smoothed.
    if (lookTarget) {
      const hp = charPos(B.Head, _v[0]);
      hp.y += 0.1 * s;
      const lt = lookTarget.isObject3D ? lookTarget.getWorldPosition(_v[1]) : _v[1].copy(lookTarget);
      lt.applyMatrix4(_mInv);
      lt.sub(hp);
      const yaw = clamp(Math.atan2(lt.x, lt.z), -1.2, 1.2);
      const pitch = clamp(-Math.atan2(lt.y, Math.hypot(lt.x, lt.z)), -0.5, 0.6);
      look2.yaw += (yaw - look2.yaw) * Math.min(1, dt * 5);
      look2.pitch += (pitch - look2.pitch) * Math.min(1, dt * 5);
    } else {
      look2.yaw *= 1 - Math.min(1, dt * 3);
      look2.pitch *= 1 - Math.min(1, dt * 3);
    }
    if (Math.abs(look2.yaw) + Math.abs(look2.pitch) > 0.002) {
      rotAxis(B.spine_03, AX.y, look2.yaw * 0.15);
      rotAxis(B.neck_01, AX.y, look2.yaw * 0.35);
      rotAxis(B.Head, AX.y, look2.yaw * 0.5);
      rotAxis(B.neck_01, AX.x, look2.pitch * 0.35);
      rotAxis(B.Head, AX.x, look2.pitch * 0.65);
    }
    // Blob shadow follows the pelvis.
    if (shadowBlob) {
      const pel = charPos(B.pelvis, _v[0]);
      shadowBlob.position.x = pel.x;
      shadowBlob.position.z = pel.z;
      const k = clamp(1 - (rig.position.y - 0.006) * 1.6, 0.4, 1.1);
      shadowBlob.scale.setScalar(k * (lieK > 0.5 ? 2 : 1));
      shadowBlob.material.opacity = 0.8 * clamp(k, 0, 1) * (1 - floatK);
    }
    // ---------- Face ----------
    let want = 'smile';
    if (act && act.expr && actW > 0.35) want = act.expr;
    else if (hold && hold.proc && hold.proc.expr) want = hold.proc.expr;
    if (exprOverride) want = exprOverride;
    const E = EXPR[want] || EXPR.neutral;
    blinkIn -= dt;
    if (blinkIn <= 0 && blinkT < 0) blinkT = 0;
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      blink = blinkT < 0.07 ? blinkT / 0.07 : blinkT < 0.16 ? 1 - (blinkT - 0.07) / 0.09 : 0;
      if (blinkT >= 0.16) {
        blinkT = -1;
        blinkIn = 2 + Math.random() * 3.5;
      }
    }
    if (hold && (hold.name === 'rest' || hold.name === 'lie' || hold.name === 'fall')) blink = 1;
    const ek = Math.min(1, dt * 8);
    for (const k of MORPHS) {
      exprNow[k] += ((E[k] || 0) - exprNow[k]) * ek;
    }
    setMorphs(M.body, blink);
  }
  let lastHoldClip = null;
  function setMorphs(mesh, blink) {
    const d = mesh.morphTargetDictionary, inf = mesh.morphTargetInfluences;
    if (!d || !inf) return;
    for (const k of MORPHS) {
      const i = d[k];
      if (i === undefined) continue;
      inf[i] = k === 'blink' ? Math.max(exprNow.blink, blink) : exprNow[k];
    }
  }

  // ---------- API ----------
  let ready = Promise.resolve();
  const api = {
    group,
    isRigged: true,
    get height() {
      return look.height + (look.helmet ? 0.07 : 0);
    },
    get headHeight() {
      return M.T.eye.y * M.scale;
    },
    get ready() {
      return ready;
    },
    get appearance() {
      return Object.assign({}, ap);
    },
    get outfit() {
      return look.outfit;
    },
    get look() {
      return look;
    },
    get speed() {
      return speed / 1.6;
    },
    get mps() {
      return speed;
    },
    get onStep() {
      return onStep;
    },
    set onStep(fn) {
      onStep = typeof fn === 'function' ? fn : null;
    },
    get carrying() {
      return !!(carry && carry.want);
    },
    get floating() {
      return floatTarget > 0;
    },
    get action() {
      return act ? act.name : hold ? hold.name : null;
    },
    get pose() {
      return hold ? hold.name : null;
    },
    joints,
    get mixer() {
      return mixer;
    },
    get clips() {
      return Object.keys(M.T.clips).concat(Object.keys(PROC));
    },
    setAppearance(a) {
      ap = Object.assign({}, ap, a || {});
      look = resolveLook(ap, Object.assign({}, opts, { helmet: helmetOverride !== null ? helmetOverride : opts.helmet }));
      build();
      return ready;
    },
    setOutfit(o) {
      opts = Object.assign({}, opts, { outfit: o });
      look = resolveLook(ap, Object.assign({}, opts, { helmet: helmetOverride !== null ? helmetOverride : opts.helmet }));
      build();
    },
    setHelmet(on) {
      helmetOverride = typeof on === 'boolean' ? on : null;
      const nl = resolveLook(ap, Object.assign({}, opts, { helmet: helmetOverride !== null ? helmetOverride : opts.helmet, outfit: opts.outfit || look.outfit }));
      if (nl.helmet !== look.helmet || nl.headwear !== look.headwear) {
        look = nl;
        build();
      }
    },
    setExpression(e) {
      exprOverride = e && EXPR[e] ? e : e === 'neutral' ? 'neutral' : null;
    },
    update,
    setMove(v) {
      speedTarget = clamp(Number(v) || 0, 0, 1) * 1.6;
    },
    setSpeed(mps) {
      speedTarget = clamp(Number(mps) || 0, 0, 9);
    },
    setLean(rad) {
      leanTarget = clamp(Number(rad) || 0, -0.35, 0.35);
    },
    setFloat(on) {
      floatTarget = on ? 1 : 0;
    },
    setSwim(k) {
      swim = clamp(Number(k) || 0, 0, 1);
    },
    // 0..1: the right hand out (zero-g handholds).
    setReach(k) {
      reachK = clamp(Number(k) || 0, 0, 1);
    },
    hop(o) {
      startAct('hop', o || {});
    },
    carry(o) {
      if (o === false || o === null) {
        if (carry) carry.want = 0;
      } else play('carry', Object.assign({ hold: true }, o || {}));
    },
    wave(o) {
      play('wave', o || {});
    },
    celebrate(o) {
      play('celebrate', o || {});
    },
    sad(o) {
      o = o || {};
      if (o.hold) {
        startAct('sad', Object.assign({}, o, { hold: true }));
      } else play('sad', o);
    },
    cheer(o) {
      play('cheer', o || {});
    },
    play,
    stopAction,
    lookAt(target) {
      lookTarget = target || null;
    },
    seek(seconds) {
      const step = 1 / 30;
      for (let t = 0; t < seconds; t += step) {
        forceFrames = 2;
        update(step);
      }
    },
    triangles() {
      let n = 0;
      group.traverse((o) => {
        let shown = o.isMesh && !!o.geometry;
        for (let q = o; shown && q; q = q.parent) shown = q.visible;
        if (shown) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });
      return Math.round(n);
    },
    drawCalls() {
      let n = 0;
      group.traverse((o) => o.isMesh && o.visible && n++);
      return n;
    },
    dispose() {
      disposed = true;
      if (M) {
        M.mixer.stopAllAction();
        M.mixer.uncacheRoot(M.rig);
        M.mats.forEach((x) => x.dispose());
      }
      if (shadowBlob) {
        shadowBlob.geometry.dispose();
        shadowBlob.material.dispose();
      }
      if (group.parent) group.parent.remove(group);
    },
  };
  let helmetOverride = typeof opts.helmet === 'boolean' ? opts.helmet : null;
  update(0);
  return api;
}
