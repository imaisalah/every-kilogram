// Options for the post pipeline (js/ll/render.js), kept free of imports so
// tests/render.test.js can check them in Node.

export const DEFAULTS = {
  bloom: { strength: 0.55, radius: 0.55, threshold: 0.9 },
  ao: { radius: 0.6, intensity: 1, distanceFallOff: 1, thickness: 1, scale: 1, samples: 12 },
  grade: { contrast: 1.08, saturation: 0.96, temperature: 0, tint: 0, lift: [0, 0, 0], gain: [1, 1, 1], exposure: 1 },
  vignette: 0.32,
  grain: 0.05,
  aberration: 0,
  blur: 0,
  fade: 0,
  fadeColor: 0x000000,
  aa: true,
};

const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

// One level deep: { bloom: { strength } } changes only the strength; false
// turns a stage off; a later object re-enables it on top of the defaults.
export function merge(base, over) {
  const o = Object.assign({}, base);
  for (const k in over || {}) {
    const v = over[k];
    if (v === undefined) continue;
    if (isPlain(v)) o[k] = Object.assign({}, isPlain(base[k]) ? base[k] : isPlain(DEFAULTS[k]) ? DEFAULTS[k] : {}, v);
    else o[k] = v;
  }
  return o;
}

// White balance as an RGB multiply: temperature warms (red up, blue down),
// tint pushes magenta (+) or green (-). Both clamp to -1..1.
export function balance(g = {}) {
  const t = Math.max(-1, Math.min(1, g.temperature || 0));
  const n = Math.max(-1, Math.min(1, g.tint || 0));
  return [1 + t * 0.12 + n * 0.04, 1 - n * 0.08, 1 - t * 0.14 + n * 0.04];
}

// Ready-made looks for the Last Light sets (merge more on top).
export const LOOKS = {
  // Night pad: cold steel-blue shadows, warm highlights, heavy bloom on the
  // floodlights, more grain.
  pad: {
    bloom: { strength: 0.75, radius: 0.7, threshold: 0.82 },
    ao: { radius: 1.6, intensity: 0.9, distanceFallOff: 1, thickness: 2 },
    grade: { contrast: 1.12, saturation: 0.9, temperature: -0.1, lift: [0.012, 0.022, 0.04], gain: [1.03, 1.0, 0.95] },
    vignette: 0.42,
    grain: 0.06,
  },
  // Cabin interiors: tight AO, softer bloom on the displays.
  interior: {
    bloom: { strength: 0.5, radius: 0.45, threshold: 0.88 },
    ao: { radius: 0.45, intensity: 1.1, distanceFallOff: 1, thickness: 1 },
    grade: { contrast: 1.1, saturation: 0.92, temperature: 0.02, lift: [0.01, 0.014, 0.02], gain: [1.0, 1.0, 0.98] },
    vignette: 0.38,
    grain: 0.055,
  },
};
