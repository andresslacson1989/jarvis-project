function normalizeSeed(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError("property seed must be an unsigned 32-bit integer");
  }
  return seed >>> 0;
}

export function createDeterministicRng(seed) {
  let state = normalizeSeed(seed) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

export function runDeterministicProperty({
  seed,
  cases,
  generate,
  check,
}) {
  if (!Number.isSafeInteger(cases) || cases < 1 || cases > 10000) {
    throw new TypeError("property cases must be an integer in [1, 10000]");
  }
  if (typeof generate !== "function" || typeof check !== "function") {
    throw new TypeError("property generate/check must be functions");
  }

  const rng = createDeterministicRng(seed);
  for (let index = 0; index < cases; index += 1) {
    const value = generate(rng, index);
    try {
      const result = check(value, index);
      if (result === false) throw new Error("property returned false");
    } catch (error) {
      const cause = error instanceof Error ? error.message : String(error);
      throw new Error(`property failed seed=${seed} case=${index}: ${cause}`);
    }
  }
}
