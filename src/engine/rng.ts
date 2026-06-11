/** Deterministic PRNG for item parameterization (§5.3). */
export function makeRng(seed: number): () => number {
  // Scramble the seed: nearby small seeds (1, 2, 3…) must not produce
  // nearby first outputs, since drill items use sequential seeds.
  let s = Math.imul(seed === 0 ? 0x9e3779b9 : seed | 0, 0x9e3779b9);
  s ^= s >>> 16;
  s = Math.imul(s, 0x85ebca6b);
  s ^= s >>> 13;
  if (s === 0) s = 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

export function randInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}
