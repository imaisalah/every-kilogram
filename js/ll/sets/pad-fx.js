// Cryogenic vapour for the pad: one instanced mesh of camera-facing puffs
// (one draw call), simulated on the CPU. Cold vapour is heavier than air: it
// pours from the vents, sinks, then rolls out along the deck and the ground.
import { THREE, canvasTex, rng, clamp } from './common.js';
import { FOG, scatterUniforms } from './pad-kit.js';

// Four soft puffs in a 2 x 2 atlas (lumpy edges, a denser core).
function puffAtlas() {
  const R = rng(77);
  return canvasTex(256, 256, (g) => {
    for (let q = 0; q < 4; q++) {
      const ox = (q % 2) * 128;
      const oy = Math.floor(q / 2) * 128;
      g.save();
      g.beginPath();
      g.rect(ox, oy, 128, 128);
      g.clip();
      for (let i = 0; i < 26; i++) {
        const a = R() * Math.PI * 2;
        const d = R() * 30;
        const x = ox + 64 + Math.cos(a) * d;
        const y = oy + 64 + Math.sin(a) * d;
        const r = 16 + R() * 26;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const al = 0.1 + R() * 0.12;
        gr.addColorStop(0, `rgba(255,255,255,${al})`);
        gr.addColorStop(0.6, `rgba(255,255,255,${al * 0.45})`);
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(ox, oy, 128, 128);
      }
      g.restore();
    }
  });
}

const VERT = /* glsl */ `
  attribute vec4 iPos;   // xyz, size
  attribute vec4 iData;  // alpha, rotation, brightness, atlas cell
  attribute vec3 iCol;
  uniform vec4 hfParams;
  uniform vec3 fogCol;
  uniform vec4 hfL[HF_N];
  uniform vec3 hfLC[HF_N];
  varying vec2 vUv;
  varying float vA;
  varying vec3 vCol;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
    float c = cos(iData.y);
    float s = sin(iData.y);
    vec2 off = mat2(c, -s, s, c) * position.xy * iPos.w;
    mv.xy += off;
    gl_Position = projectionMatrix * mv;
    float cell = iData.w;
    vUv = (uv + vec2(mod(cell, 2.0), floor(cell / 2.0))) * 0.5;
    float d = -mv.z;
    // Fade out right in front of the lens and for puffs much bigger than the gap.
    vA = iData.x * smoothstep(0.4, 1.5 + iPos.w * 0.35, d);
    // Height fog, per puff (same formula as the surfaces).
    vec3 rd = iPos.xyz - cameraPosition;
    float dist = length(rd);
    float k = hfParams.y * rd.y;
    float ratio = abs(k) > 1e-4 ? (1.0 - exp(-k)) / k : 1.0;
    float fi = hfParams.x * exp(-hfParams.y * (cameraPosition.y - hfParams.z)) * dist * ratio + hfParams.w * dist;
    float f = 1.0 - exp(-fi * 0.8);
    // Lit by the lamps nearby (the same ones that light the haze).
    vec3 lit = vec3(0.32);
    for (int i = 0; i < HF_N; i++) {
      vec3 q = hfL[i].xyz - iPos.xyz;
      lit += hfLC[i] * (hfL[i].w * 90.0 / (dot(q, q) + 60.0));
    }
    vCol = mix(iCol * iData.z * lit, fogCol, f);
    vA *= 1.0 - f * 0.6;
    #include <logdepthbuf_vertex>
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying float vA;
  varying vec3 vCol;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float a = texture2D(map, vUv).a * vA;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vCol, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// emitters: [{ name, at: [x,y,z] | () => [x,y,z], rate (per s), life, size: [a, b],
//   vel: [x,y,z], spread, alpha, color, bright, sink (m/s^2 down), drag, jitter (spawn radius),
//   ring: { r, y0, y1 } (spawn on a cylinder) }]
// floor(x, z) -> the height vapour cannot sink below.
export function createVapour(o = {}) {
  const max = o.max || 600;
  const R = rng(o.seed || 5);
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', iPos);
  geo.setAttribute('iData', iData);
  geo.setAttribute('iCol', iCol);
  geo.instanceCount = 0;
  const tex = puffAtlas();
  const mat = new THREE.ShaderMaterial({
    uniforms: scatterUniforms({ map: { value: tex }, hfParams: FOG.params, fogCol: { value: o.fogColor || new THREE.Color(0x0b1118) } }),
    vertexShader: '#define HF_N ' + FOG.n + '\n' + VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  mesh.userData.noAO = true;
  mesh.name = 'vapour';

  const emitters = (o.emitters || []).map((e) => Object.assign({ acc: 0, rate: 4, life: 5, size: [1, 4], vel: [0, 0, 0], spread: 0.3, alpha: 0.25, color: 0xdfe8f0, bright: 1, sink: 0.2, drag: 0.4, jitter: 0.3, on: true }, e, { col: new THREE.Color(e.color || 0xdfe8f0) }));
  const floor = o.floor || (() => 0.2);
  const wind = o.wind || [0.35, 0, 0.12];
  // Particle pool.
  const P = [];
  for (let i = 0; i < max; i++) P.push({ live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, s0: 1, s1: 1, a: 0, rot: 0, spin: 0, cell: 0, e: null });
  let free = P.slice();
  const live = [];
  let rateK = o.rateScale != null ? o.rateScale : 1;

  function spawn(e) {
    const p = free.pop();
    if (!p) return;
    let at = typeof e.at === 'function' ? e.at(R) : e.at;
    if (e.ring) {
      const a = R() * Math.PI * 2;
      at = [e.ring.x || 0, e.ring.y0 + R() * (e.ring.y1 - e.ring.y0), e.ring.z || 0];
      at[0] += Math.cos(a) * e.ring.r;
      at[2] += Math.sin(a) * e.ring.r;
      p.vx = Math.cos(a) * (e.out || 0.2);
      p.vz = Math.sin(a) * (e.out || 0.2);
      p.vy = e.vel[1];
    } else {
      p.vx = e.vel[0] + (R() - 0.5) * 2 * e.spread;
      p.vy = e.vel[1] + (R() - 0.5) * 2 * e.spread * 0.6;
      p.vz = e.vel[2] + (R() - 0.5) * 2 * e.spread;
    }
    const j = e.jitter;
    p.x = at[0] + (R() - 0.5) * 2 * j;
    p.y = at[1] + (R() - 0.5) * 2 * j * 0.5;
    p.z = at[2] + (R() - 0.5) * 2 * j;
    p.age = 0;
    p.life = e.life * (0.75 + R() * 0.5);
    p.s0 = e.size[0] * (0.8 + R() * 0.4);
    p.s1 = e.size[1] * (0.8 + R() * 0.4);
    p.a = e.alpha * (0.7 + R() * 0.6);
    p.rot = R() * Math.PI * 2;
    p.spin = (R() - 0.5) * 0.3;
    p.cell = Math.floor(R() * 4);
    p.e = e;
    p.live = true;
    live.push(p);
  }

  function update(dt, t) {
    dt = Math.min(dt, 0.1);
    for (const e of emitters) {
      if (!e.on) continue;
      e.acc += e.rate * rateK * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        spawn(e);
      }
    }
    let n = 0;
    const gust = 1 + Math.sin(t * 0.37) * 0.35 + Math.sin(t * 1.3) * 0.1;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.live = false;
        live[i] = live[live.length - 1];
        live.pop();
        free.push(p);
        continue;
      }
      const e = p.e;
      const k = Math.exp(-e.drag * dt);
      p.vx = p.vx * k + wind[0] * gust * (1 - k);
      p.vz = p.vz * k + wind[2] * gust * (1 - k);
      p.vy = p.vy * k - e.sink * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fl = floor(p.x, p.z) + p.s0 * 0.25;
      if (p.y < fl) {
        // Heavy vapour hits the floor and spreads out.
        p.y = fl;
        if (p.vy < 0) {
          const sp = -p.vy * 0.6;
          const h = Math.hypot(p.vx, p.vz) || 1;
          p.vx += (p.vx / h) * sp;
          p.vz += (p.vz / h) * sp;
          p.vy = 0;
        }
      }
      p.rot += p.spin * dt;
    }
    // Write the live ones.
    const P4 = iPos.array;
    const D4 = iData.array;
    const C3 = iCol.array;
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      const k = p.age / p.life;
      const fade = Math.min(1, k * 5) * (1 - k) * (1 - k * 0.3);
      const s = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
      P4[n * 4] = p.x;
      P4[n * 4 + 1] = p.y;
      P4[n * 4 + 2] = p.z;
      P4[n * 4 + 3] = s;
      D4[n * 4] = p.a * fade;
      D4[n * 4 + 1] = p.rot;
      D4[n * 4 + 2] = p.e.bright;
      D4[n * 4 + 3] = p.cell;
      C3[n * 3] = p.e.col.r;
      C3[n * 3 + 1] = p.e.col.g;
      C3[n * 3 + 2] = p.e.col.b;
      n++;
    }
    geo.instanceCount = n;
    iPos.needsUpdate = iData.needsUpdate = iCol.needsUpdate = true;
    if (n) {
      iPos.addUpdateRange(0, n * 4);
      iData.addUpdateRange(0, n * 4);
      iCol.addUpdateRange(0, n * 3);
    }
  }

  // Warm up: run the simulation so the first frame already has vapour.
  function prewarm(seconds = 8) {
    for (let t = 0; t < seconds; t += 1 / 15) update(1 / 15, t);
  }

  return {
    mesh,
    emitters,
    update,
    prewarm,
    get count() {
      return live.length;
    },
    setRate(k) {
      rateK = k;
    },
    emitter(name) {
      return emitters.find((e) => e.name === name);
    },
  };
}

// Ground fog sheets: big flat puffs lying in layers a few metres above the
// apron, drifting on the GPU (one draw call, no CPU work). Seen from the
// ground they are nearly edge-on and fade out; seen from the arm at 92 m they
// stack into a sea of fog, glowing around the lamps.
const SHEET_V = /* glsl */ `
  attribute vec4 iSheet;   // x, y, z, size
  attribute vec2 iSpin;    // rotation, drift phase
  uniform float time;
  uniform vec2 wind;
  uniform vec4 area;       // minX, minZ, sizeX, sizeZ (wrap)
  uniform vec4 hfL[HF_N];
  uniform vec3 hfLC[HF_N];
  uniform vec3 base;
  varying vec2 vUv;
  varying float vA;
  varying vec3 vCol;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec2 p = iSheet.xz + wind * time * (0.7 + 0.3 * sin(iSpin.y));
    p = area.xy + mod(p - area.xy, area.zw);
    float c = cos(iSpin.x + time * 0.01);
    float s = sin(iSpin.x + time * 0.01);
    vec2 q = mat2(c, -s, s, c) * position.xy * iSheet.w;
    vec3 w = vec3(p.x + q.x, iSheet.y, p.y + q.y);
    vec4 mv = viewMatrix * vec4(w, 1.0);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vec3 toCam = cameraPosition - w;
    float d = length(toCam);
    // Fade edge-on views, the near ones and the edges of the wrap area.
    float steep = abs(toCam.y) / max(d, 1e-3);
    vec2 e = min(p - area.xy, area.xy + area.zw - p) / (area.zw * 0.12);
    vA = smoothstep(0.04, 0.35, steep) * smoothstep(4.0, 18.0, d) * clamp(min(e.x, e.y), 0.0, 1.0);
    vec3 lit = base;
    for (int i = 0; i < HF_N; i++) {
      vec3 l = hfL[i].xyz - w;
      lit += hfLC[i] * (hfL[i].w * 260.0 / (dot(l, l) + 300.0));
    }
    vCol = lit;
    #include <logdepthbuf_vertex>
  }`;
const SHEET_F = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;
  varying float vA;
  varying vec3 vCol;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float a = texture2D(map, vUv).a * vA * opacity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vCol, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createFogSheets(o = {}) {
  const n = o.count || 60;
  const R = rng(o.seed || 9);
  const area = o.area || [-90, -70, 190, 200];
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    a[i * 4] = area[0] + R() * area[2];
    a[i * 4 + 1] = 0.6 + Math.pow(R(), 1.6) * (o.top || 7);
    a[i * 4 + 2] = area[1] + R() * area[3];
    a[i * 4 + 3] = 18 + R() * 30;
    b[i * 2] = R() * 6.28;
    b[i * 2 + 1] = R() * 6.28;
  }
  geo.setAttribute('iSheet', new THREE.InstancedBufferAttribute(a, 4));
  geo.setAttribute('iSpin', new THREE.InstancedBufferAttribute(b, 2));
  geo.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    uniforms: scatterUniforms({
      map: { value: o.map || puffAtlas() },
      time: { value: 0 },
      wind: { value: new THREE.Vector2(o.wind ? o.wind[0] : 0.4, o.wind ? o.wind[1] : 0.15) },
      area: { value: new THREE.Vector4(area[0], area[1], area[2], area[3]) },
      base: { value: new THREE.Color(o.color || 0x1e2833) },
      opacity: { value: o.opacity || 0.5 },
    }),
    vertexShader: '#define HF_N ' + FOG.n + '\n' + SHEET_V,
    fragmentShader: SHEET_F,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // Use one whole puff of the atlas per sheet (top-left cell, UV 0..0.5).
  const uv = geo.attributes.uv;
  const u2 = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) (u2[i * 2] = uv.getX(i) * 0.5), (u2[i * 2 + 1] = 0.5 + uv.getY(i) * 0.5);
  geo.setAttribute('uv', new THREE.BufferAttribute(u2, 2));
  // Lie flat.
  const pos = quad.attributes.position;
  const flat = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) (flat[i * 3] = pos.getX(i)), (flat[i * 3 + 1] = pos.getY(i)), (flat[i * 3 + 2] = 0);
  geo.setAttribute('position', new THREE.BufferAttribute(flat, 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.userData.noAO = true;
  mesh.name = 'fogsheets';
  return {
    mesh,
    update(dt, t) {
      mat.uniforms.time.value = t;
    },
  };
}

export { clamp };
