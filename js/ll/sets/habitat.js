// Last Light set "habitat": the whole connected interior (js/ll/sets/interior.js)
// with `start` inside the habitat.
import { createInterior } from './interior.js';

export function create(opts = {}) {
  return createInterior(Object.assign({}, opts, { id: 'habitat', start: 'habitat' }));
}
export default create;
