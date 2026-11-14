// Loads a Last Light set by id and dresses a scene for it.
//   import { loadSet, applyMood } from './sets/index.js';
//   const set = await loadSet('pad', { appearance });   // see common.js for the contract
//   scene.add(set.group); applyMood(scene, set);          // background, fog
//   sceneObj.post = set.mood.post; sceneObj.shadows = set.mood.shadows; sceneObj.exposure = set.mood.exposure;
// capsule, tunnel and habitat are one connected interior: each id builds the
// whole interior and only differs in where `start` is.
export const SETS = ['pad', 'capsule', 'tunnel', 'habitat'];

export async function loadSet(id, opts = {}) {
  if (!SETS.includes(id)) throw new Error('unknown set ' + id);
  const m = await import(new URL('./' + id + '.js', import.meta.url).href);
  return m.create(opts);
}

export function applyMood(scene, set) {
  const m = (set && set.mood) || {};
  if (m.background !== undefined) scene.background = m.background;
  if (m.fog !== undefined) scene.fog = m.fog;
  if (m.environment !== undefined) scene.environment = m.environment;
}
