// Surface renderer, part 1 of 3: everything that is light and spectacle.
// Lamps shared by every lit material, pooled GPU particles, tracers, ground
// splats, beams. Nothing here allocates per shot: emitters write into ring
// buffers and the vertex shaders do the moving.
import { THREE } from '../3d/engine.js';

const SMD = (globalThis.SMD = globalThis.SMD || {});

export function quality() {
  try {
    return SMD.settings.profile();
  } catch (e) {
    return { tier: 'high', particles: 1, shadowMapMax: 2048, segments: 256 };
  }
}
export function reducedMotion() {
  try {
    return !!(SMD.settings && SMD.settings.reducedMotion);
  } catch (e) {
    return false;
  }
}

// Depth chunks: the renderer uses a logarithmic depth buffer, so every custom
// shader has to write it the same way or depth tests come out wrong.
export const LOG_V_PARS = `
#include <common>
#include <logdepthbuf_pars_vertex>
`;
export const LOG_V = `
#include <logdepthbuf_vertex>
`;
export const LOG_F_PARS = `
#include <logdepthbuf_pars_fragment>
`;
export const LOG_F = `
#include <logdepthbuf_fragment>
`;

// ---------- Lamps ----------
// Forward lights get expensive fast and changing their number recompiles every
// shader. So floodlights, helmet lamps, muzzle flashes and goo glows are one
// fixed array of "lamps" that every patched material loops over. The list is
// rebuilt per frame; the strongest near the action win the slots.
export function createLamps(maxLamps) {
  const N = maxLamps;
  const uniforms = {
    uLampPos: { value: new Float32Array(4 * N) }, // x y z radius
    uLampCol: { value: new Float32Array(4 * N) }, // r g b conePower (0 = all round)
    uLampDir: { value: new Float32Array(3 * N) }, // where a cone points
    uLampN: { value: 0 },
    uLampCamW: { value: new THREE.Matrix4() },
  };
  const pending = [];
  const pool = [];
  let focusX = 0;
  let focusZ = 0;
  const api = {
    N,
    uniforms,
    setFocus(x, z) {
      focusX = x;
      focusZ = z;
    },
    begin() {
      for (let i = 0; i < pending.length; i++) pool.push(pending[i]);
      pending.length = 0;
    },
    // color is [r,g,b] in linear-ish units; dir + cone make it a spot.
    add(x, y, z, radius, r, g, b, dir, cone) {
      const L = pool.pop() || {};
      L.x = x;
      L.y = y;
      L.z = z;
      L.radius = radius;
      L.r = r;
      L.g = g;
      L.b = b;
      L.dx = dir ? dir[0] : 0;
      L.dy = dir ? dir[1] : -1;
      L.dz = dir ? dir[2] : 0;
      L.cone = cone || 0;
      const dist = Math.hypot(x - focusX, z - focusZ);
      L.score = (Math.max(r, g, b) * radius) / (6 + dist);
      pending.push(L);
    },
    end() {
      pending.sort((a, b) => b.score - a.score);
      const pos = uniforms.uLampPos.value;
      const col = uniforms.uLampCol.value;
      const dir = uniforms.uLampDir.value;
      const n = Math.min(N, pending.length);
      for (let i = 0; i < n; i++) {
        const L = pending[i];
        pos[i * 4] = L.x;
        pos[i * 4 + 1] = L.y;
        pos[i * 4 + 2] = L.z;
        pos[i * 4 + 3] = L.radius;
        col[i * 4] = L.r;
        col[i * 4 + 1] = L.g;
        col[i * 4 + 2] = L.b;
        col[i * 4 + 3] = L.cone;
        dir[i * 3] = L.dx;
        dir[i * 3 + 1] = L.dy;
        dir[i * 3 + 2] = L.dz;
      }
      uniforms.uLampN.value = n;
    },
  };
  return api;
}

const lampFragment = (N) => /* glsl */ `
  uniform vec4 uLampPos[${N}];
  uniform vec4 uLampCol[${N}];
  uniform vec3 uLampDir[${N}];
  uniform int uLampN;
  varying vec3 vLampWP;
  vec3 lampIrradiance(vec3 wp, vec3 n) {
    vec3 sum = vec3(0.0);
    for (int i = 0; i < uLampN; i++) {
      vec4 p = uLampPos[i];
      vec3 L = p.xyz - wp;
      float d = length(L);
      if (d >= p.w) continue;
      L /= max(d, 0.001);
      float k = 1.0 - d / p.w;
      k *= k;
      float cone = uLampCol[i].a;
      if (cone > 0.0) {
        float c = dot(-L, uLampDir[i]);
        if (c <= 0.0) continue;
        k *= pow(c, cone);
      }
      sum += uLampCol[i].rgb * k * (0.3 + 0.7 * max(0.0, dot(n, L)));
    }
    return sum;
  }
`;

// Teach a built-in lit material about the lamps (rocks, the lander, aliens,
// the rigged suits). Safe to call twice.
export function lampify(mat, lamps) {
  if (!mat || mat.userData.lamped || !(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) return mat;
  mat.userData.lamped = true;
  const prevCompile = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (sh, r) {
    if (prevCompile) prevCompile.call(this, sh, r);
    Object.assign(sh.uniforms, lamps.uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLampWP;\nuniform mat4 uLampCamW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLampWP = (uLampCamW * mvPosition).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + lampFragment(lamps.N))
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse += lampIrradiance(vLampWP, inverseTransformDirection(normal, viewMatrix)) * BRDF_Lambert(material.diffuseColor);`);
  };
  mat.customProgramCacheKey = function () {
    return (prevKey ? prevKey.call(this) : '') + '|lamp' + lamps.N;
  };
  mat.needsUpdate = true;
  return mat;
}

// ---------- GPU particles ----------
// Each particle is written once, at birth; the shader computes where it is now.
// mode 0: fades and shrinks (sparks, goo). 1: grows and fades (dust, smoke).
export function createParticles(max, opts = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const vel = new Float32Array(max * 4); // vx vy vz gravity
  const life = new Float32Array(max * 4); // birth life size mode
  const col = new Float32Array(max * 4); // r g b alpha
  const aPos = new THREE.BufferAttribute(pos, 3);
  const aVel = new THREE.BufferAttribute(vel, 4);
  const aLife = new THREE.BufferAttribute(life, 4);
  const aCol = new THREE.BufferAttribute(col, 4);
  for (const a of [aPos, aVel, aLife, aCol]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos);
  geo.setAttribute('aVel', aVel);
  geo.setAttribute('aLife', aLife);
  geo.setAttribute('aCol', aCol);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  // Nothing alive until a particle is born.
  life.fill(-1);
  const uniforms = { uTime: { value: 0 }, uScale: { value: 400 }, uDrag: { value: opts.drag || 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      attribute vec4 aVel;
      attribute vec4 aLife;
      attribute vec4 aCol;
      uniform float uTime;
      uniform float uScale;
      uniform float uDrag;
      varying vec4 vC;
      varying float vMode;
      void main() {
        float age = uTime - aLife.x;
        float u = aLife.y > 0.0 ? age / aLife.y : 2.0;
        if (u < 0.0 || u >= 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 0.0); gl_PointSize = 0.0; return; }
        vec3 p = position + aVel.xyz * (uDrag > 0.0 ? (1.0 - exp(-uDrag * age)) / uDrag : age);
        p.y += aVel.w * age * age * 0.5;
        if (p.y < 0.03) p.y = 0.03;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
        float s = aLife.z;
        s *= aLife.w < 0.5 ? (1.0 - u * u) : (0.35 + 1.1 * sqrt(u));
        gl_PointSize = clamp(s * uScale / max(-mv.z, 0.1), 0.0, 400.0);
        vMode = aLife.w;
        float a = aLife.w < 0.5 ? (1.0 - u) : (u < 0.12 ? u / 0.12 : pow(1.0 - (u - 0.12) / 0.88, 1.3));
        vC = vec4(aCol.rgb, aCol.a * a);
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      varying vec4 vC;
      varying float vMode;
      void main() {
        ${LOG_F}
        vec2 c = gl_PointCoord - 0.5;
        float d = dot(c, c) * 4.0;
        if (d > 1.0) discard;
        float k = (vMode < 0.5) ? pow(1.0 - d, 1.6) : (1.0 - d) * (1.0 - d);
        gl_FragColor = vec4(vC.rgb, vC.a * k);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = opts.order || 6;
  points.userData.noAO = true;
  let head = 0;
  let dirty = false;
  let lo = max;
  let hi = 0;
  const api = {
    points,
    uniforms,
    emit(x, y, z, vx, vy, vz, g, lifeS, size, mode, r, gg, b, a) {
      const i = head;
      head = (head + 1) % max;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 4] = vx;
      vel[i * 4 + 1] = vy;
      vel[i * 4 + 2] = vz;
      vel[i * 4 + 3] = g;
      life[i * 4] = uniforms.uTime.value;
      life[i * 4 + 1] = lifeS;
      life[i * 4 + 2] = size;
      life[i * 4 + 3] = mode;
      col[i * 4] = r;
      col[i * 4 + 1] = gg;
      col[i * 4 + 2] = b;
      col[i * 4 + 3] = a;
      dirty = true;
      lo = Math.min(lo, i);
      hi = Math.max(hi, i);
    },
    update(t, cam, viewH) {
      uniforms.uTime.value = t;
      uniforms.uScale.value = viewH / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
      if (dirty) {
        for (const a of [aPos, aVel, aLife, aCol]) {
          const size = a.itemSize;
          a.clearUpdateRanges();
          a.addUpdateRange(lo * size, (hi - lo + 1) * size);
          a.needsUpdate = true;
        }
        dirty = false;
        lo = max;
        hi = 0;
      }
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
  return api;
}

// ---------- Tracers: stretched glowing quads between two points ----------
export function createTracers(max) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const aInfo = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); // birth life width
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  for (const a of [aA, aB, aInfo, aCol]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aA', aA);
  geo.setAttribute('aB', aB);
  geo.setAttribute('aInfo', aInfo);
  geo.setAttribute('aCol', aCol);
  geo.instanceCount = max;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  aInfo.array.fill(-10);
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      attribute vec3 aA;
      attribute vec3 aB;
      attribute vec3 aInfo;
      attribute vec3 aCol;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vC;
      varying float vAge;
      void main() {
        float u = (uTime - aInfo.x) / max(aInfo.y, 0.001);
        if (u < 0.0 || u >= 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 0.0); return; }
        // A bolt of light that races from the muzzle to the hit.
        float head = clamp(u * 2.2, 0.0, 1.0);
        float tail = clamp((u - 0.25) * 1.8, 0.0, 1.0);
        float along = position.x + 0.5;
        vec3 p = mix(mix(aA, aB, tail), mix(aA, aB, head), along);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 mvA = modelViewMatrix * vec4(aA, 1.0);
        vec4 mvB = modelViewMatrix * vec4(aB, 1.0);
        vec3 dir = normalize(mvB.xyz - mvA.xyz);
        vec3 side = normalize(cross(dir, normalize(-mv.xyz)));
        mv.xyz += side * position.y * aInfo.z;
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
        vUv = vec2(along, position.y + 0.5);
        vC = aCol;
        vAge = u;
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      varying vec2 vUv;
      varying vec3 vC;
      varying float vAge;
      void main() {
        ${LOG_F}
        float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float a = pow(max(0.0, across), 1.6) * smoothstep(0.0, 0.15, vUv.x) * (1.0 - vAge * vAge);
        gl_FragColor = vec4(vC * (1.0 + 1.2 * across * across), a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  mesh.userData.noAO = true;
  let head = 0;
  return {
    mesh,
    fire(x0, y0, z0, x1, y1, z1, life, width, r, g, b) {
      const i = head;
      head = (head + 1) % max;
      aA.setXYZ(i, x0, y0, z0);
      aB.setXYZ(i, x1, y1, z1);
      aInfo.setXYZ(i, uniforms.uTime.value, life, width);
      aCol.setXYZ(i, r, g, b);
      for (const a of [aA, aB, aInfo, aCol]) a.needsUpdate = true;
    },
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      base.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}

// ---------- Ground splats: goo glows, scorch rings, blast marks ----------
export function createDecals(max) {
  const base = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // x y z size
  const aInfo = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // birth life rot seed
  const aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // rgb kind
  for (const a of [aPos, aInfo, aCol]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aInfo', aInfo);
  geo.setAttribute('aCol', aCol);
  geo.instanceCount = max;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  aInfo.array.fill(-100);
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      attribute vec4 aPos;
      attribute vec4 aInfo;
      attribute vec4 aCol;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vC;
      varying float vA;
      varying float vSeed;
      varying float vKind;
      void main() {
        float u = (uTime - aInfo.x) / max(aInfo.y, 0.001);
        if (u < 0.0 || u >= 1.0) { gl_Position = vec4(0.0, 0.0, 2.0, 0.0); return; }
        float c = cos(aInfo.z), s = sin(aInfo.z);
        vec3 l = position * aPos.w * (aCol.a > 1.5 ? 1.0 : 0.6 + 0.4 * min(1.0, u * 12.0));
        vec3 p = vec3(l.x * c - l.z * s, l.y, l.x * s + l.z * c) + aPos.xyz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
        vUv = uv - 0.5;
        vC = aCol.rgb;
        vA = u;
        vSeed = aInfo.w;
        vKind = aCol.a;
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      varying vec2 vUv;
      varying vec3 vC;
      varying float vA;
      varying float vSeed;
      varying float vKind;
      float n(float a) { return sin(a * 3.0 + vSeed) * 0.5 + sin(a * 7.0 + vSeed * 2.3) * 0.3 + sin(a * 13.0 + vSeed * 4.1) * 0.2; }
      void main() {
        ${LOG_F}
        float r = length(vUv) * 2.0;
        float ang = atan(vUv.y, vUv.x);
        float a;
        if (vKind > 1.5) {
          // A blast ring: thin, expanding, gone.
          float rim = (1.0 - smoothstep(0.0, 0.08, abs(r - (0.4 + vA * 0.55))));
          a = rim * (1.0 - vA);
        } else if (vKind > 0.5) {
          // A scorch: darkens by masking the glow to nothing, a soft black ring.
          a = (1.0 - smoothstep(0.5, 1.0, r + n(ang) * 0.1)) * 0.5 * (1.0 - vA * vA);
          gl_FragColor = vec4(vC * a, a);
          return;
        } else {
          // Goo: a lobed splat, hot centre, slow fade, glow dying first.
          float edge = 0.7 + n(ang) * 0.22;
          float body = (1.0 - smoothstep(edge - 0.32, edge, r));
          float drops = (1.0 - smoothstep(0.0, 0.12, abs(r - 0.82 - n(ang * 2.0) * 0.1))) * step(0.3, n(ang * 3.0));
          a = (body + drops * 0.6) * (1.0 - vA) * (1.0 - vA);
        }
        gl_FragColor = vec4(vC, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.userData.noAO = true;
  let head = 0;
  return {
    mesh,
    add(x, y, z, size, life, r, g, b, kind) {
      const i = head;
      head = (head + 1) % max;
      aPos.setXYZW(i, x, y + 0.06, z, size);
      aInfo.setXYZW(i, uniforms.uTime.value, life, Math.random() * 6.28, Math.random() * 40);
      aCol.setXYZW(i, r, g, b, kind || 0);
      aPos.needsUpdate = aInfo.needsUpdate = aCol.needsUpdate = true;
    },
    update(t) {
      uniforms.uTime.value = t;
    },
    dispose() {
      base.dispose();
      geo.dispose();
      mat.dispose();
    },
  };
}

// ---------- Soft beams: floodlight cones, uplink beam, plume ----------
export function beamMaterial(color, opts = {}) {
  const c = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: c }, uOpacity: { value: opts.opacity != null ? opts.opacity : 0.5 }, uTime: { value: 0 }, uFade: { value: opts.fade != null ? opts.fade : 1.4 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${LOG_V_PARS}
      varying vec3 vN;
      varying vec3 vV;
      varying float vV01;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        ${LOG_V}
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vV01 = uv.y;
      }`,
    fragmentShader: /* glsl */ `
      ${LOG_F_PARS}
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uFade;
      varying vec3 vN;
      varying vec3 vV;
      varying float vV01;
      void main() {
        ${LOG_F}
        float facing = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), uFade);
        float along = vV01; along = along * along;
        float flicker = 0.97 + 0.03 * sin(uTime * 2.0 + vV01 * 6.0);
        gl_FragColor = vec4(uColor * flicker, clamp(uOpacity * facing * along, 0.0, 1.0));
      }`,
  });
}

// A flat ring or disc that lies on the ground; used for role rings, site halos,
// revive progress. Geometry comes from the caller.
export function haloMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
}

// ---------- Rock that holds up close: world-space grit on every face ----------
export function gritRock(mat, grit, strength = 0.9) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (sh, r) {
    if (prev) prev.call(this, sh, r);
    sh.uniforms.uGrit = { value: grit };
    sh.uniforms.uGritK = { value: strength };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGritP;\nvarying vec3 vGritN;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        #ifdef USE_INSTANCING
          vGritP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vGritP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif
        vGritN = normalize(mat3(modelMatrix) * objectNormal);`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGrit;\nuniform float uGritK;\nvarying vec3 vGritP;\nvarying vec3 vGritN;\nfloat gritV;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 b = abs(normalize(vGritN));
          b = pow(b, vec3(4.0));
          b /= (b.x + b.y + b.z);
          float g1 = texture2D(uGrit, vGritP.yz * 0.33).r * b.x + texture2D(uGrit, vGritP.xz * 0.33).r * b.y + texture2D(uGrit, vGritP.xy * 0.33).r * b.z;
          float g2 = texture2D(uGrit, vGritP.yz * 1.1).r * b.x + texture2D(uGrit, vGritP.xz * 1.1).r * b.y + texture2D(uGrit, vGritP.xy * 1.1).r * b.z;
          gritV = g1 * 0.65 + g2 * 0.35;
          diffuseColor.rgb *= mix(1.0, 0.55 + gritV * 0.95, uGritK);
        }`
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.8 + gritV * 0.4), 0.05, 1.0);');
  };
  mat.customProgramCacheKey = function () {
    return (prevKey ? prevKey.call(this) : '') + '|grit';
  };
  mat.needsUpdate = true;
  return mat;
}
