// Last Light set "tunnel": the whole connected interior (js/ll/sets/interior.js)
// with `start` at the tunnel's capsule end.
import { createInterior } from './interior.js';

export function create(opts = {}) {
  return createInterior(Object.assign({}, opts, { id: 'tunnel', start: 'tunnel' }));
}
export default create;
