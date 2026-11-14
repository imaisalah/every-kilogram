// Post-processing for Last Light (docs/LASTLIGHT.md, "Looks"): one pipeline any
// scene can ask for through the engine. A scene object that carries
// `post: {...}` is drawn through it by js/3d/engine.js mount(); scenes without
// it render exactly as before.
//
//   render pass (HDR, MSAA on high) -> GTAO (high only) -> bloom -> final pass
//   final pass = ACES tone map + sRGB + filmic grade (contrast, saturation,
//   lift/gain, white balance) + vignette + film grain + chromatic aberration
//   + optional blur (CO2 headache) and fade; then FXAA on low.
//
// sceneObj.post (every key optional; `false` turns a stage off):
//   {
//     bloom: { strength: 0.55, radius: 0.55, threshold: 0.9 } | false,
//     ao: { radius: 0.6, intensity: 1, distanceFallOff: 1, thickness: 1, scale: 1 } | false,
//     grade: { contrast: 1.08, saturation: 0.96, temperature: 0 (-1 cool..1 warm),
//              tint: 0 (-1 green..1 magenta), lift: [r,g,b] (shadow colour, ~0.0-0.05),
//              gain: [r,g,b] (highlight multiply, ~1), exposure: 1 (multiplies the scene's) },
//     vignette: 0.32, grain: 0.05, aberration: 0 (base, 0..1), blur: 0 (0..1),
//     fade: 0 (0..1 to fadeColor), fadeColor: 0x000000, aa: true,
//   }
// The engine exposes the live pipeline as getPost() (null while it loads or
// without post): post.set(partial) merges options (e.g. { blur: 0.4 }),
// post.impact(k) kicks chromatic aberration + a vignette pulse that decays
// (a hit, a jolt), post.info() gives { tier, ao, bloom, msaa, aa }.
//
// Quality (SMD.settings.tier()): high = MSAA x4 (WebGL2), GTAO at half
// resolution, full bloom; low = no AO, FXAA, no
// MSAA. The renderer uses a logarithmic depth buffer, so GTAO gets its own
// G-buffer (view normal + standard NDC depth in a float target) instead of
// reading the hardware depth.
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../../vendor/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from '../../vendor/postprocessing/Pass.js';
import { UnrealBloomPass } from '../../vendor/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from '../../vendor/postprocessing/GTAOPass.js';
import { FXAAShader } from '../../vendor/shaders/FXAAShader.js';
import { DEFAULTS, LOOKS, merge, balance } from './post-options.js';

export { DEFAULTS, LOOKS, merge };

const SMD = (globalThis.SMD = globalThis.SMD || {});

export function tier() {
  try {
    return SMD.settings && SMD.settings.tier ? SMD.settings.tier() : 'high';
  } catch (e) {
    return 'high';
  }
}

const reducedMotion = () => {
  try {
    return !!(SMD.settings && SMD.settings.reducedMotion);
  } catch (e) {
    return false;
  }
};

// ---------- The final pass: tone map + grade + vignette + grain + CA ----------
const FINAL_VERT = /* glsl */ `
  precision highp float;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  attribute vec3 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FINAL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float pixelRatio;
  uniform float time;
  uniform float contrast;
  uniform float saturation;
  uniform vec3 lift;
  uniform vec3 gain;
  uniform vec3 balance;
  uniform float vignette;
  uniform float grain;
  uniform float aberration;
  uniform float blur;
  uniform float fade;
  uniform vec3 fadeColor;
  #include <tonemapping_pars_fragment>
  #include <colorspace_pars_fragment>
  varying vec2 vUv;

  // Integer-free hash (Dave Hoskins), stable on every GPU.
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 fetch(vec2 uv) {
    if (aberration <= 0.0001) return texture2D(tDiffuse, uv).rgb;
    vec2 d = uv - 0.5;
    vec2 off = d * aberration * (0.006 + dot(d, d) * 0.03);
    return vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
  }

  void main() {
    vec3 c = fetch(vUv);
    if (blur > 0.001) {
      // A soft 12-tap disc: the CO2 headache, a knock to the head.
      vec2 px = blur * 9.0 / resolution;
      vec3 acc = c;
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 2.39996;
        float r = sqrt(float(i) + 0.5) / 3.5;
        acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * px * resolution.y / 900.0 * 1.6).rgb;
      }
      c = mix(c, acc / 13.0, clamp(blur * 1.6, 0.0, 1.0));
    }
    c *= balance;

    #if defined( ACES_FILMIC_TONE_MAPPING )
      c = ACESFilmicToneMapping(c);
    #elif defined( AGX_TONE_MAPPING )
      c = AgXToneMapping(c);
    #elif defined( REINHARD_TONE_MAPPING )
      c = ReinhardToneMapping(c);
    #elif defined( CINEON_TONE_MAPPING )
      c = OptimizedCineonToneMapping(c);
    #elif defined( LINEAR_TONE_MAPPING )
      c = LinearToneMapping(c);
    #endif

    vec4 o = vec4(clamp(c, 0.0, 1.0), 1.0);
    #ifdef SRGB_TRANSFER
      o = sRGBTransferOETF(o);
    #endif
    c = o.rgb;

    // Filmic grade in display space: lift the blacks toward a colour, gain the
    // highlights, an S-curve for contrast, then saturation around the luma.
    c = c * gain + lift * (1.0 - c);
    vec3 s = c * c * (3.0 - 2.0 * c);
    c = mix(c, s, clamp(contrast - 1.0, -1.0, 1.0) * 1.6);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);

    // Vignette, a touch oval (wider than tall).
    vec2 d = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
    float vg = smoothstep(0.35, 1.05, length(d) * 1.05);
    c *= 1.0 - vignette * vg;

    c = mix(c, fadeColor, clamp(fade, 0.0, 1.0));

    // Grain: about 1.5 CSS px, strongest in the mid-tones, also dithers banding.
    vec2 gp = floor(gl_FragCoord.xy / max(1.0, pixelRatio * 1.25));
    float n = hash13(vec3(gp, floor(time * 24.0))) + hash13(vec3(gp + 17.0, floor(time * 24.0) + 3.0)) - 1.0;
    float lm = dot(c, vec3(0.299, 0.587, 0.114));
    c += n * grain * (0.35 + 0.65 * (1.0 - abs(lm * 2.0 - 1.0)));
    c += (hash13(vec3(gl_FragCoord.xy, time)) - 0.5) / 255.0;

    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

class FinalPass extends Pass {
  constructor() {
    super();
    this.uniforms = {
      tDiffuse: { value: null },
      toneMappingExposure: { value: 1 },
      resolution: { value: new THREE.Vector2(1, 1) },
      pixelRatio: { value: 1 },
      time: { value: 0 },
      contrast: { value: 1 },
      saturation: { value: 1 },
      lift: { value: new THREE.Vector3() },
      gain: { value: new THREE.Vector3(1, 1, 1) },
      balance: { value: new THREE.Vector3(1, 1, 1) },
      vignette: { value: 0 },
      grain: { value: 0 },
      aberration: { value: 0 },
      blur: { value: 0 },
      fade: { value: 0 },
      fadeColor: { value: new THREE.Color(0, 0, 0) },
    };
    this.material = new THREE.RawShaderMaterial({ name: 'LLFinal', uniforms: this.uniforms, vertexShader: FINAL_VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false });
    this.fsQuad = new FullScreenQuad(this.material);
    this.exposure = 1;
    this._cs = null;
    this._tm = null;
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.toneMappingExposure.value = renderer.toneMappingExposure * this.exposure;
    if (this._cs !== renderer.outputColorSpace || this._tm !== renderer.toneMapping) {
      this._cs = renderer.outputColorSpace;
      this._tm = renderer.toneMapping;
      const d = {};
      if (THREE.ColorManagement.getTransfer(this._cs) === THREE.SRGBTransfer) d.SRGB_TRANSFER = '';
      const tm = this._tm;
      if (tm === THREE.ACESFilmicToneMapping) d.ACES_FILMIC_TONE_MAPPING = '';
      else if (tm === THREE.AgXToneMapping) d.AGX_TONE_MAPPING = '';
      else if (tm === THREE.ReinhardToneMapping) d.REINHARD_TONE_MAPPING = '';
      else if (tm === THREE.CineonToneMapping) d.CINEON_TONE_MAPPING = '';
      else if (tm === THREE.LinearToneMapping) d.LINEAR_TONE_MAPPING = '';
      this.material.defines = d;
      this.material.needsUpdate = true;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

// ---------- GTAO with its own G-buffer (the depth buffer is logarithmic) ----------
// MeshNormalMaterial (it handles skinning, instancing and morphs) patched to
// also write the standard NDC depth into alpha.
function gbufferMaterial() {
  const m = new THREE.MeshNormalMaterial();
  m.blending = THREE.NoBlending;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec2 vZW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvZW = gl_Position.zw;');
    sh.fragmentShader = 'varying vec2 vZW;\n' + sh.fragmentShader.replace('gl_FragColor = vec4( packNormalToRGB( normal ), opacity );', 'gl_FragColor = vec4( packNormalToRGB( normal ), clamp( ( vZW.x / vZW.y ) * 0.5 + 0.5, 0.0, 1.0 ) );');
  };
  m.customProgramCacheKey = () => 'll-gbuffer';
  return m;
}

class AOPass extends Pass {
  constructor(scene, camera, w, h, params, renderer) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.scale = 0.5; // half resolution
    const ok = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    this.gbuffer = new THREE.WebGLRenderTarget(1, 1, { type: ok ? THREE.FloatType : THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.gtao = new GTAOPass(scene, camera, 2, 2);
    this.gtao.setGBuffer(this.gbuffer.texture, this.gbuffer.texture);
    this.gtao.normalRenderTarget.setSize(1, 1);
    this.material = gbufferMaterial();
    this.hidden = [];
    this.set(params);
  }
  set(p = {}) {
    this.gtao.updateGtaoMaterial({ radius: p.radius, distanceFallOff: p.distanceFallOff, thickness: p.thickness, scale: p.scale, samples: p.samples, distanceExponent: p.distanceExponent });
    this.gtao.updatePdMaterial({ radius: 6, lumaPhi: 10, depthPhi: 2, normalPhi: 3, samples: 12, rings: 2 });
    this.gtao.blendIntensity = p.intensity != null ? p.intensity : 1;
  }
  setSize(w, h) {
    const sw = Math.max(1, Math.round(w * this.scale));
    const sh = Math.max(1, Math.round(h * this.scale));
    this.gbuffer.setSize(sw, sh);
    this.gtao.setSize(sw, sh);
    this.gtao.normalRenderTarget.setSize(1, 1);
  }
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    const cam = this.camera;
    this.gtao.camera = cam;
    this.gtao.gtaoMaterial.defines.PERSPECTIVE_CAMERA = cam.isPerspectiveCamera ? 1 : 0;
    // Things that are not surfaces (beams, fog, sprites, particles, glass)
    // stay out of the G-buffer.
    const hidden = this.hidden;
    hidden.length = 0;
    this.scene.traverseVisible((o) => {
      if (o.isPoints || o.isLine || o.isSprite || (o.isMesh && (o.userData.noAO || (o.material && !Array.isArray(o.material) && (o.material.transparent || o.material.depthWrite === false))))) hidden.push(o);
    });
    for (let i = 0; i < hidden.length; i++) hidden[i].visible = false;
    const bg = this.scene.background;
    const fog = this.scene.fog;
    this.scene.background = null;
    this.scene.fog = null;
    const oc = renderer.getClearColor(new THREE.Color());
    const oa = renderer.getClearAlpha();
    renderer.setRenderTarget(this.gbuffer);
    renderer.setClearColor(0x7777ff, 1);
    renderer.clear(true, true, false);
    this.scene.overrideMaterial = this.material;
    renderer.render(this.scene, cam);
    this.scene.overrideMaterial = null;
    renderer.setClearColor(oc, oa);
    this.scene.background = bg;
    this.scene.fog = fog;
    for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
    this.gtao.renderToScreen = this.renderToScreen;
    this.gtao.render(renderer, writeBuffer, readBuffer, dt, mask);
  }
  dispose() {
    this.gbuffer.dispose();
    this.gtao.dispose();
    this.gtao.blendMaterial.dispose();
    this.gtao.gtaoMaterial.dispose();
    this.material.dispose();
  }
}

// ---------- The pipeline ----------
export function createPost(renderer, scene, camera, options = {}) {
  const T = tier();
  const high = T !== 'low';
  const webgl2 = !!renderer.capabilities.isWebGL2;
  let opts = merge(DEFAULTS, options || {});
  const size = renderer.getSize(new THREE.Vector2());
  let pr = renderer.getPixelRatio();

  const msaa = high && webgl2 && opts.aa !== false ? 4 : 0;
  const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), { type: THREE.HalfFloatType, samples: msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  let ao = null;
  if (high && webgl2 && opts.ao) {
    try {
      ao = new AOPass(scene, camera, size.x * pr, size.y * pr, opts.ao, renderer);
      composer.addPass(ao);
    } catch (e) {
      console.warn('ambient occlusion is off', e);
      ao = null;
    }
  }

  let bloom = null;
  if (opts.bloom) {
    const b = opts.bloom;
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), b.strength, b.radius, b.threshold);
    composer.addPass(bloom);
  }

  const final = new FinalPass();
  composer.addPass(final);

  let fxaa = null;
  if (!msaa && opts.aa !== false) {
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
  }

  let time = 0;
  let kick = 0; // impact: decays over about half a second

  function apply() {
    const g = opts.grade || DEFAULTS.grade;
    const u = final.uniforms;
    u.contrast.value = g.contrast != null ? g.contrast : 1;
    u.saturation.value = g.saturation != null ? g.saturation : 1;
    const lift = g.lift || [0, 0, 0];
    const gain = g.gain || [1, 1, 1];
    u.lift.value.set(lift[0], lift[1], lift[2]);
    u.gain.value.set(gain[0], gain[1], gain[2]);
    const bl = balance(g);
    u.balance.value.set(bl[0], bl[1], bl[2]);
    final.exposure = g.exposure != null ? g.exposure : 1;
    u.grain.value = opts.grain || 0;
    u.fade.value = opts.fade || 0;
    u.fadeColor.value.set(opts.fadeColor != null ? opts.fadeColor : 0);
    if (bloom && opts.bloom) {
      bloom.strength = opts.bloom.strength;
      bloom.radius = opts.bloom.radius;
      bloom.threshold = opts.bloom.threshold;
    }
    if (bloom) bloom.enabled = !!opts.bloom;
    if (ao) {
      ao.enabled = !!opts.ao;
      if (opts.ao) ao.set(opts.ao);
    }
  }

  function setSize(w, h) {
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    final.uniforms.resolution.value.set(Math.max(1, w * pr), Math.max(1, h * pr));
    final.uniforms.pixelRatio.value = pr;
    if (fxaa) fxaa.material.uniforms.resolution.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr));
  }

  apply();
  setSize(size.x, size.y);

  const post = {
    composer,
    tier: T,
    get options() {
      return opts;
    },
    get passes() {
      return { render: renderPass, ao, bloom, final, fxaa };
    },
    set(partial) {
      opts = merge(opts, partial || {});
      apply();
    },
    impact(k = 1) {
      if (reducedMotion()) k *= 0.35;
      kick = Math.min(1.5, Math.max(kick, k));
    },
    render(dt, sc, cam) {
      // The engine's automatic quality may have changed the resolution.
      const rp = renderer.getPixelRatio();
      if (rp !== pr) post.setPixelRatio(rp);
      if (sc && sc !== renderPass.scene) {
        renderPass.scene = sc;
        if (ao) ao.scene = ao.gtao.scene = sc;
      }
      if (cam && cam !== renderPass.camera) {
        renderPass.camera = cam;
        if (ao) ao.camera = cam;
      }
      time += dt || 0;
      kick = Math.max(0, kick - (dt || 0) * 2.2);
      const u = final.uniforms;
      u.time.value = time;
      u.aberration.value = (opts.aberration || 0) + kick * kick * 1.2;
      u.vignette.value = (opts.vignette || 0) + kick * 0.25;
      u.blur.value = opts.blur || 0;
      composer.render(dt);
    },
    setSize,
    setPixelRatio(p) {
      pr = p;
      const s = renderer.getSize(new THREE.Vector2());
      setSize(s.x, s.y);
    },
    info() {
      return { tier: T, ao: !!(ao && ao.enabled), bloom: !!(bloom && bloom.enabled), msaa, aa: msaa ? 'msaa' : fxaa ? 'fxaa' : 'none' };
    },
    dispose() {
      composer.passes.forEach((p) => p.dispose && p.dispose());
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
    },
  };
  return post;
}

// The director's form (js/ll/director.js): one pipeline for the whole game
// session; each set brings its own look.
//   const p = createPipeline({ renderer, scene, camera });
//   p.setScene(scene, camera, set)   // set.post, else set.mood.post, else LOOKS by kind
//   p.render(dt); p.setSize(w, h); p.update(dt); p.dispose();
//   p.set(partial), p.impact(k), p.info() as in createPost.
export function createPipeline(o = {}) {
  const renderer = o.renderer;
  let scene = o.scene;
  let camera = o.camera;
  let look = o.post || {};
  let post = null;
  const build = () => {
    if (post) post.dispose();
    post = createPost(renderer, scene, camera, look);
  };
  build();
  // Tier changes rebuild the pipeline (AO, MSAA, bloom size depend on it).
  let tierNow = tier();
  return {
    get post() {
      return post;
    },
    setScene(sc, cam, set) {
      scene = sc || scene;
      camera = cam || camera;
      const own = set && (set.post || (set.mood && set.mood.post));
      look = own || (set && set.volume ? LOOKS.interior : LOOKS.pad);
      build();
    },
    update() {},
    render(dt) {
      const t = tier();
      if (t !== tierNow) {
        tierNow = t;
        build();
      }
      post.render(dt, scene, camera);
    },
    setSize(w, h) {
      post.setSize(w, h);
    },
    set(partial) {
      post.set(partial);
    },
    impact(k) {
      post.impact(k);
    },
    info() {
      return post.info();
    },
    dispose() {
      if (post) post.dispose();
      post = null;
    },
  };
}
