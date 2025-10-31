let _poseidon: any | undefined;

async function getPoseidon() {
  if (_poseidon) return _poseidon;
  const lib = await import("circomlibjs");
  // circomlibjs exposes poseidon directly in modern versions
  _poseidon = (lib as any).poseidon ?? (lib as any).buildPoseidon?.();
  return _poseidon;
}

export async function poseidonHash(inputs: Array<bigint | number | string>): Promise<bigint> {
  const p = await getPoseidon();
  const arr = inputs.map((v) => (typeof v === "bigint" ? v : typeof v === "number" ? BigInt(v) : BigInt(v)));
  const out = p(arr);
  // Some circomlib versions return a BN-like with toString; normalize to bigint
  if (typeof out === "bigint") return out;
  if (out && typeof out.toString === "function") return BigInt(out.toString());
  return BigInt(out);
}

