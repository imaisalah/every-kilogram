// What the interior's windows see: a separate "outside" scene (stars, the
// Sun, the Moon with the NASA LRO map, Earth) drawn once per frame into a
// render target from the main camera's orientation (no translation: the
// bodies are effectively at infinity), then sampled in screen space by every
// window pane. Ideas from js/3d/capsule.js (portal), rebuilt for Last Light.
import { THREE, clamp } from './common.js';
import { makePlanet, makeStars, makeSun } from '../../3d/assets.js';

const DEG = Math.PI / 180;

// Directions in the interior frame (+z forward along the stack, y up).
// deg = apparent diameter. sun = direction toward the Sun.
export const VIEWS = {
  // Chapter 1: the Moon ahead, half lit, fills much of the habitat window;
  // Earth small beside it.
  approach: { moon: { dir: [0.1, 0.07, 1], deg: 33, spin: 2.6 }, earth: { dir: [-0.24, -0.13, 1], deg: 2.6, spin: 1.2 }, sun: [-0.85, 0.35, 0.3] },
  // Behind the Moon: no Sun, the far side a black disc against the stars.
  farside: { moon: { dir: [0, 0, 1], deg: 60, spin: 0.4 }, earth: null, sun: null },
  earth: { moon: null, earth: { dir: [0.1, 0.05, 1], deg: 12, spin: 2 }, sun: [0.6, 0.6, 0.4] },
  space: { moon: null, earth: null, sun: [-0.85, 0.35, 0.3] },
};

const PORTAL_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const PORTAL_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uOutside;
uniform sampler2D uFrostMap;
uniform vec2 uRes;
uniform float uFrost;
uniform float uDim;
uniform vec3 uTint;
uniform float uRed;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 col = texture2D(uOutside, suv).rgb;
  vec4 fm = texture2D(uFrostMap, vUv);
  // Glass: a faint reflection of the lit cabin, stronger at grazing angles,
  // smudges catch it; edge darkening from the thick multi-pane window.
  float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 3.0);
  vec3 refl = uTint * (0.02 + 0.16 * fres) * uDim + vec3(0.6, 0.04, 0.02) * uRed * (0.02 + 0.1 * fres);
  col += refl + uTint * fm.g * 0.05 * (0.3 + uDim);
  float edge = smoothstep(0.0, 0.5, 1.0 - fm.r);
  col *= mix(0.45, 1.0, edge);
  float fr = smoothstep(1.0 - uFrost * 1.1, 1.0 - uFrost * 1.1 + 0.3, fm.r) * uFrost;
  col = mix(col, vec3(0.62, 0.68, 0.74) * (0.08 + 0.3 * uDim), clamp(fr, 0.0, 0.9));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createOutside(o = {}) {
  const low = o.tier === 'low';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const root = new THREE.Group();
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(50, 1, 5, 4e5);
  const stars = makeStars(low ? 1800 : 4200, 2e5, 23);
  stars.material.size = low ? 1.4 : 1.7;
  root.add(stars);
  const sun = new THREE.DirectionalLight(0xffffff, 5.5);
  root.add(sun, sun.target);
  const sunSprite = makeSun(9000);
  root.add(sunSprite);
  scene.add(new THREE.AmbientLight(0x1a2230, 0.03));
  let moon = null;
  let earth = null;
  try {
    moon = makePlanet('moon', 1000, { segments: low ? 64 : 128, res: low ? 512 : 1024 });
    earth = makePlanet('earth', 1000, { segments: low ? 48 : 64, res: 512 });
    root.add(moon, earth);
  } catch (e) {
    console.warn('interior: planets unavailable', e);
  }
  // Earthshine on the Moon's night side would be a nice extra; a tiny
  // ambient keeps the dark limb from being pure black against black.

  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  const uniforms = {
    uOutside: { value: rt.texture },
    uFrostMap: { value: o.frost || null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFrost: { value: 0 },
    uDim: { value: 1 },
    uTint: { value: new THREE.Color(0xcfdcff) },
    uRed: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG });

  let view = VIEWS.approach;
  function setView(spec) {
    const v = typeof spec === 'string' ? VIEWS[spec] || VIEWS.approach : Object.assign({}, VIEWS.approach, spec || {});
    const place = (body, s) => {
      if (!body) return;
      body.visible = !!s;
      if (!s) return;
      const dir = new THREE.Vector3().fromArray(s.dir).normalize();
      const d = 1000 / Math.tan((s.deg * DEG) / 2);
      body.position.copy(dir).multiplyScalar(d);
      body.rotation.set(0.1, s.spin || 0, 0);
    };
    place(moon, v.moon);
    place(earth, v.earth);
    if (v.sun) {
      const sd = new THREE.Vector3().fromArray(v.sun).normalize();
      sun.visible = true;
      sun.intensity = 5.5;
      sun.position.copy(sd).multiplyScalar(1e5);
      sunSprite.visible = true;
      sunSprite.position.copy(sd).multiplyScalar(1.6e5);
    } else {
      // No Sun: keep a faint light so the makePlanet shader has a direction,
      // and turn it almost off.
      sun.intensity = 0.0;
      sunSprite.visible = false;
    }
    view = v;
    return v;
  }
  setView(o.view || 'approach');

  let need = true;
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const size = new THREE.Vector2();
  // Called from a pane's onBeforeRender: draws the outside once per frame.
  function render(renderer, scene0, cam, group) {
    if (!need || renderer.isNullRenderer || !cam || !cam.isPerspectiveCamera) return;
    need = false;
    renderer.getDrawingBufferSize(size);
    const k = low ? 0.5 : 0.75;
    const w = Math.max(2, Math.round(size.x * k));
    const h = Math.max(2, Math.round(size.y * k));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    uniforms.uRes.value.copy(size);
    camera.fov = cam.fov;
    camera.aspect = cam.aspect;
    camera.updateProjectionMatrix();
    group.getWorldQuaternion(qa).invert();
    cam.getWorldQuaternion(qb);
    camera.quaternion.copy(qa).multiply(qb);
    camera.position.set(0, 0, 0);
    camera.updateMatrixWorld();
    const cur = renderer.getRenderTarget();
    const xr = renderer.xr.enabled;
    const sh = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.xr.enabled = xr;
    renderer.shadowMap.autoUpdate = sh;
    renderer.setRenderTarget(cur);
  }

  return {
    scene,
    camera,
    material,
    uniforms,
    moon,
    earth,
    get view() {
      return view;
    },
    setView,
    render,
    frame() {
      need = true;
    },
    setDim(k) {
      uniforms.uDim.value = clamp(k);
    },
    dispose() {
      rt.dispose();
      material.dispose();
      scene.traverse((x) => {
        if (x.geometry) x.geometry.dispose();
        const m = x.material;
        if (m && !(m.userData && m.userData.keep)) {
          for (const key in m) if (m[key] && m[key].isTexture && !(m[key].userData && m[key].userData.keep) && !isShared(m[key])) m[key].dispose();
          m.dispose();
        }
      });
    },
  };
}
// Textures from SMD.assets are cached and shared: never dispose them.
function isShared(t) {
  return !!(t.userData && (t.userData.keep || t.userData.shared)) || !!(t.image && t.image.src && /assets\/textures\//.test(t.image.src));
}
