// Build step for the character GLBs (dev tool; run through run.mjs).
// Source: Quaternius "Universal Base Characters" (Standard) and "Universal
// Animation Library" (Standard), both CC0. What this does:
//  - bodies: keeps the body, eyes and eyebrows meshes and the 65-bone skin,
//    drops the extra UV/colour sets and the roughness map, makes the skin
//    colour map "neutral" (divided by the mean skin colour, so the game tints
//    it to any skin tone) at 1024 px JPEG, the normal map at 1024 px JPEG;
//  - hair: the head-bone hairstyles become plain meshes in Head-bone space
//    (the game parents them to the Head bone), grey textures at 512 px;
//  - animations: the clips the game uses, without scale tracks, without
//    position tracks except the pelvis, without the finger-tip leaf bones,
//    redundant keys removed.
import * as THREE from 'three';
import { GLTFLoader } from '/vendor/GLTFLoader.js';
import { GLTFExporter } from './GLTFExporter.js';

const SRC = '/src/';
const BASE = SRC + 'Universal Base Characters[Standard]/Base Characters/Godot - UE/';
const HAIR = SRC + 'Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/';
const ANIM = SRC + 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb';

export const CLIPS = [
  'Idle_Loop', 'Idle_Talking_Loop', 'Idle_Torch_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop',
  'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Swim_Idle_Loop', 'Swim_Fwd_Loop', 'Interact', 'PickUp_Table',
  'Push_Loop', 'Fixing_Kneeling', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Sitting_Exit',
  'Driving_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Hit_Chest', 'Death01', 'Dance_Loop',
];
const HAIRS = ['Hair_SimpleParted', 'Hair_Buzzed', 'Hair_BuzzedFemale', 'Hair_Buns', 'Hair_Long', 'Hair_Beard'];

const loader = new GLTFLoader();
const load = (url) => new Promise((res, rej) => loader.load(encodeURI(url), res, undefined, rej));
const log = (...a) => console.log(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

function canvasOf(img, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, size, size);
  return { c, g };
}
function tex(canvas, like, mime = 'image/jpeg') {
  const t = new THREE.CanvasTexture(canvas);
  t.flipY = like ? like.flipY : false;
  t.colorSpace = like ? like.colorSpace : THREE.NoColorSpace;
  t.wrapS = like ? like.wrapS : THREE.RepeatWrapping;
  t.wrapT = like ? like.wrapT : THREE.RepeatWrapping;
  t.userData.mimeType = mime;
  return t;
}
// Divide by the mean skin colour (per channel), so the mean becomes 200/255.
function neutralSkin(img, size) {
  const { c, g } = canvasOf(img, size);
  const im = g.getImageData(0, 0, size, size);
  const d = im.data;
  let n = 0;
  const m = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    if (r > 90 && r > b + 25) {
      m[0] += r; m[1] += gg; m[2] += b; n++;
    }
  }
  m[0] /= n; m[1] /= n; m[2] /= n;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, (d[i + k] / m[k]) * 200);
  g.putImageData(im, 0, 0);
  log('skin mean', m.map((x) => +x.toFixed(1)));
  return c;
}
// Grey, normalised so the mean is 170/255 (the game tints it to the hair colour).
function greyHair(img, size) {
  const { c, g } = canvasOf(img, size);
  const im = g.getImageData(0, 0, size, size);
  const d = im.data;
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (l > 8) { s += l; n++; }
  }
  const mean = s / n;
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.min(255, ((0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / mean) * 170);
    d[i] = d[i + 1] = d[i + 2] = l;
  }
  g.putImageData(im, 0, 0);
  return c;
}
function strip(geo) {
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
  geo.morphAttributes = {};
}
async function exportGLB(input, animations = []) {
  const ex = new GLTFExporter();
  const buf = await ex.parseAsync(input, { binary: true, onlyVisible: false, animations, maxTextureSize: 1024 });
  return buf;
}
function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const hairTexCache = new Map();
function hairMaterial(src) {
  const key = src.map.name || src.name;
  if (hairTexCache.has(key)) return hairTexCache.get(key);
  const m = new THREE.MeshStandardMaterial({ name: src.name, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  m.map = tex(greyHair(src.map.image, 512), src.map);
  if (src.normalMap) m.normalMap = tex(canvasOf(src.normalMap.image, 512).c, src.normalMap);
  hairTexCache.set(key, m);
  return m;
}

async function body(file, outName) {
  const g = await load(BASE + file);
  const scene = g.scene;
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => o.isSkinnedMesh && meshes.push(o));
  const info = {};
  for (const m of meshes) {
    strip(m.geometry);
    const src = m.material;
    if (/Eyes/.test(src.name)) {
      m.name = 'Eyes';
      const mat = new THREE.MeshStandardMaterial({ name: 'Eyes', roughness: 0.25, metalness: 0 });
      mat.map = tex(canvasOf(src.map.image, 256).c, src.map, 'image/png');
      m.material = mat;
    } else if (/Hair/.test(src.name)) {
      m.name = 'Eyebrows';
      const mat = hairMaterial(src).clone();
      mat.name = 'Eyebrows';
      m.material = mat;
    } else {
      m.name = 'Body';
      const mat = new THREE.MeshStandardMaterial({ name: 'Skin', roughness: 0.55, metalness: 0 });
      mat.map = tex(neutralSkin(src.map.image, 1024), src.map);
      mat.normalMap = tex(canvasOf(src.normalMap.image, 1024).c, src.normalMap);
      m.material = mat;
    }
    m.geometry.computeBoundingBox();
    info[m.name] = { min: m.geometry.boundingBox.min.toArray().map((v) => +v.toFixed(4)), max: m.geometry.boundingBox.max.toArray().map((v) => +v.toFixed(4)), verts: m.geometry.attributes.position.count };
  }
  const bones = {};
  scene.traverse((o) => {
    if (o.isBone && /^(pelvis|Head|neck_01|foot_l|ball_l|hand_l|lowerarm_l|upperarm_l|thigh_l|calf_l|spine_03)$/.test(o.name)) bones[o.name] = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).toArray().map((v) => +v.toFixed(4));
  });
  log(outName, info, bones);
  return exportGLB(scene);
}

async function hairs() {
  const group = new THREE.Group();
  group.name = 'Hairs';
  for (const name of HAIRS) {
    const g = await load(HAIR + name + '.gltf');
    g.scene.updateMatrixWorld(true);
    let sm = null;
    g.scene.traverse((o) => o.isSkinnedMesh && !sm && (sm = o));
    const sk = sm.skeleton;
    const hi = sk.bones.findIndex((b) => b.name === 'Head');
    const M = sk.boneInverses[hi].clone().multiply(sm.bindMatrix);
    const geo = sm.geometry.clone();
    strip(geo);
    geo.deleteAttribute('skinIndex');
    geo.deleteAttribute('skinWeight');
    geo.applyMatrix4(M);
    const mesh = new THREE.Mesh(geo, hairMaterial(sm.material));
    mesh.name = name;
    group.add(mesh);
    geo.computeBoundingBox();
    log(name, 'head-local box', geo.boundingBox.min.toArray().map((v) => +v.toFixed(3)), geo.boundingBox.max.toArray().map((v) => +v.toFixed(3)), 'Head world', new THREE.Vector3().setFromMatrixPosition(sk.bones[hi].matrixWorld).toArray().map((v) => +v.toFixed(4)));
  }
  return exportGLB(group);
}

async function anims() {
  const g = await load(ANIM);
  const scene = g.scene;
  const drop = [];
  scene.traverse((o) => o.isMesh && drop.push(o));
  drop.forEach((o) => o.parent.remove(o));
  const clips = [];
  for (const name of CLIPS) {
    const c = g.animations.find((a) => a.name === name);
    if (!c) {
      log('missing clip', name);
      continue;
    }
    c.tracks = c.tracks.filter((t) => {
      const [node, prop] = t.name.split('.');
      if (/leaf/.test(node) || node === 'root') return false;
      if (prop === 'scale') return false;
      if (prop === 'position' && node !== 'pelvis') return false;
      return true;
    });
    c.tracks.forEach((t) => t.optimize());
    clips.push(c);
  }
  let pelvis = null;
  scene.traverse((o) => o.name === 'pelvis' && (pelvis = o));
  log('mannequin pelvis rest', pelvis.position.toArray());
  return exportGLB(scene, clips);
}

(async () => {
  const out = {};
  try {
    out['ek-body-m.glb'] = b64(await body('Superhero_Male_FullBody.gltf', 'male'));
    out['ek-body-f.glb'] = b64(await body('Superhero_Female_FullBody.gltf', 'female'));
    out['ek-hair.glb'] = b64(await hairs());
    out['ek-anims.glb'] = b64(await anims());
  } catch (e) {
    console.log('build failed', e && e.stack);
  }
  window.buildOut = out;
  window.buildDone = true;
})();
