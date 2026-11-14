// Shared helpers for the Last Light sets (js/ll/sets/*.js).
//
// The set contract (docs/LASTLIGHT.md): every set module exports
//   create(opts) -> {
//     id, group, anchors: { name: Object3D }, colliders: { circles, boxes },
//     walkable (ground mode, js/3d/controller.js format) | null,
//     volume ({ min, max, clamp(p) }, zero-g) | null,
//     lights: [THREE.Light], mood: { background, fog, exposure, shadows, post },
//     ready: Promise (textures and models that load late),
//     update(dt, t, camera), setAlarm(on), setPower(0..1), dispose()
//   }
// Anchors are plain Object3Ds in the set's group: their world position is
// where a character stands (feet) or floats, and their local +Z is the way a
// character placed there faces (yaw = rotation.y).
import * as THREE from 'three';
import { mergeGeometries } from '../../../vendor/BufferGeometryUtils.js';

export { THREE };
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);

export function reducedMotion() {
  try {
    const S = globalThis.SMD && globalThis.SMD.settings;
    if (S && S.reducedMotion !== undefined) return !!S.reducedMotion;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

export function tier() {
  try {
    const S = globalThis.SMD && globalThis.SMD.settings;
    return S && S.tier ? S.tier() : 'high';
  } catch (e) {
    return 'high';
  }
}

// Seeded random (mulberry32).
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function anchor(name, x = 0, y = 0, z = 0, yaw = 0) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  o.rotation.y = yaw;
  o.userData.anchor = true;
  return o;
}

// Canvas texture (sRGB by default). draw(ctx, w, h).
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(o.repeat[0], o.repeat[1]);
  }
  t.anisotropy = o.anisotropy || 4;
  return t;
}

// Collects geometry per material and bakes one merged mesh per material:
// hundreds of bolts, rails and panels in a handful of draw calls.
//   const b = new Builder();
//   b.add(mat, new THREE.BoxGeometry(1, 1, 1), { p: [x, y, z], r: [rx, ry, rz], s: [sx, sy, sz] });
//   b.bake(group, { castShadow, receiveShadow });
export class Builder {
  constructor() {
    this.parts = new Map();
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
  }
  add(mat, geo, o = {}) {
    const p = o.p || [0, 0, 0];
    const r = o.r || [0, 0, 0];
    const s = o.s || [1, 1, 1];
    this.e.set(r[0], r[1], r[2], o.order || 'XYZ');
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(p[0], p[1], p[2]), this.q, new THREE.Vector3(s[0], s[1], s[2]));
    if (o.matrix) this.m.premultiply(o.matrix);
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    if (o.color) {
      const c = new THREE.Color(o.color);
      const n = g.attributes.position.count;
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) (a[i * 3] = c.r), (a[i * 3 + 1] = c.g), (a[i * 3 + 2] = c.b);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
    g.applyMatrix4(this.m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    if (o.dispose !== false && geo !== g && o.keep !== true && geo.userData && geo.userData.temp) geo.dispose();
    return this;
  }
  // Same geometry at many matrices.
  addMatrix(mat, geo, matrix, o = {}) {
    return this.add(mat, geo, Object.assign({}, o, { matrix }));
  }
  bake(parent, o = {}) {
    const out = [];
    for (const [mat, list] of this.parts) {
      // Vertex colours: every piece needs the attribute once any piece has it.
      const anyColor = list.some((g) => g.attributes.color);
      if (anyColor)
        list.forEach((g) => {
          if (!g.attributes.color) {
            const n = g.attributes.position.count;
            g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
          }
        });
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = o.castShadow !== false;
      mesh.receiveShadow = o.receiveShadow !== false;
      if (o.name) mesh.name = o.name;
      parent.add(mesh);
      out.push(mesh);
    }
    this.parts.clear();
    return out;
  }
}

// A soft volumetric light cone (fake god rays through fog/dust): additive,
// brightest along the axis, fading toward the edges, the far end and where it
// meets geometry close to the camera. Place it at the lamp; it points along -Y
// of its local frame (rotate it like a SpotLight's direction).
//   const beam = lightBeam({ length: 40, radius: 9, color: 0xfff0d0, intensity: 0.6 });
export function lightBeam(o = {}) {
  const len = o.length || 10;
  const r0 = o.radiusTop != null ? o.radiusTop : 0.15;
  const r1 = o.radius || 3;
  const geo = new THREE.CylinderGeometry(r0, r1, len, o.segments || 24, 12, true);
  geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(o.color || 0xffffff) },
      intensity: { value: o.intensity != null ? o.intensity : 0.5 },
      len: { value: len },
      time: { value: 0 },
      noise: { value: o.noise != null ? o.noise : 0.35 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      varying vec3 vW;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vY = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      uniform float intensity;
      uniform float len;
      uniform float time;
      uniform float noise;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      varying vec3 vW;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vnoise(vec3 x) {
        vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        #include <logdepthbuf_fragment>
        float edge = abs(dot(normalize(vN), normalize(vV)));
        edge = pow(edge, 1.6);
        float along = clamp(-vY / len, 0.0, 1.0);
        float fall = (1.0 - along) * (1.0 - along) * smoothstep(0.0, 0.06, along);
        float n = vnoise(vW * 0.35 + vec3(0.0, time * 0.25, time * 0.11));
        float a = edge * fall * intensity * mix(1.0, 0.45 + n, noise);
        gl_FragColor = vec4(color * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.noAO = true;
  mesh.renderOrder = 5;
  mesh.frustumCulled = true;
  return mesh;
}

// A soft round sprite texture (glows, lamp flares, fog puffs).
let dotTex = null;
export function softDot() {
  if (dotTex) return dotTex;
  dotTex = canvasTex(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  dotTex.userData.keep = true;
  return dotTex;
}

// Dispose everything under root that is not marked userData.keep.
export function disposeGroup(root) {
  root.traverse((o) => {
    if (o.geometry && !(o.geometry.userData && o.geometry.userData.keep)) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      if (m.userData && m.userData.keep) return;
      for (const k in m) {
        const v = m[k];
        if (v && v.isTexture && !(v.userData && v.userData.keep)) v.dispose();
      }
      if (m.uniforms)
        for (const k in m.uniforms) {
          const v = m.uniforms[k] && m.uniforms[k].value;
          if (v && v.isTexture && !(v.userData && v.userData.keep)) v.dispose();
        }
      m.dispose();
    });
  });
  if (root.parent) root.parent.remove(root);
}

// Count draw calls and triangles a group would cost (meshes, not culling).
export function cost(root) {
  let meshes = 0;
  let tris = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    meshes++;
    const g = o.geometry;
    const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1);
  });
  return { meshes, triangles: Math.round(tris) };
}
