// Last Light set "capsule": the whole connected interior (js/ll/sets/interior.js)
// with `start` among the seats.
import { createInterior } from './interior.js';

export function create(opts = {}) {
  return createInterior(Object.assign({}, opts, { id: 'capsule', start: 'capsule' }));
}
export default create;
