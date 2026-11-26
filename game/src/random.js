// A tiny seeded random source (mulberry32) so the world, the clouds and the
// screenshot scenes are the same for the same seed, every time.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable hash of two integers, for sea sparkles that must not flicker. */
export function hash2(a, b) {
  let value = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
