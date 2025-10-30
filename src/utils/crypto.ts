import { buildPoseidonOpt } from "circomlibjs"; // runtime poseidon
let poseidonPromise: Promise<any> | null = null;

export async function getPoseidon() {
  if (!poseidonPromise) poseidonPromise = buildPoseidonOpt();
  return poseidonPromise;
}

export async function poseidon2([a, b]: [bigint, bigint]): Promise<bigint> {
  const p = await getPoseidon();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return BigInt(p.F.toObject(p([a, b])));
}

export async function poseidonN(xs: bigint[]): Promise<bigint> {
  const p = await getPoseidon();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return BigInt(p.F.toObject(p(xs)));
}

export function randomField(): bigint {
  // NOTE: replace with proper field-sized RNG; placeholder using crypto.getRandomValues via Node
  const buf = new Uint32Array(8);
  const { randomFillSync } = awaitImportCrypto();
  randomFillSync(buf as unknown as Buffer);
  let x = 0n;
  for (const n of buf) x = (x << 32n) ^ BigInt(n);
  return x;
}

async function awaitImportCrypto() {
  // Node >= 19 has global 'crypto', but keep explicit for clarity
  // @ts-ignore
  return await import("node:crypto");
}
