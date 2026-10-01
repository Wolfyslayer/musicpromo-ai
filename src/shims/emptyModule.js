/** Browser stand-in for Node built-ins pulled in by Transformers.js. */
function noop() {
  return "";
}

const empty = {};

export default empty;
export const join = noop;
export const dirname = noop;
export const resolve = noop;
export const fileURLToPath = noop;
