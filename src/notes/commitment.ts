import { poseidonHash } from "../crypto/poseidon.js";

// Field modulus for BN254 (must match circuit)
const FQ = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function modF(x: bigint): bigint {
  return ((x % FQ) + FQ) % FQ;
}

function toBigInt(val: bigint | number | string): bigint {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(val);
  if (typeof val === 'string') {
    if (val.startsWith('0x') || val.startsWith('0X')) return BigInt(val);
    return BigInt(val);
  }
  return BigInt(val);
}

export async function commitmentOf(
  input:
    | Array<bigint | number | string>
    | { amount: bigint | number | string; tokenId: bigint | number | string; ownerCipherPayPubKey: bigint | number | string; randomness: { r: bigint | number | string; s?: bigint | number | string }; memo?: bigint | number | string }
): Promise<bigint> {
  if (Array.isArray(input)) {
    // For array input, apply modF to each element (matching test pattern)
    const modded = input.map(v => modF(toBigInt(v)));
    return await poseidonHash(modded);
  }
  // ORDER MUST MATCH CIRCUIT: [amount, cipherPayPubKey, randomness, tokenId, memo]
  // Apply modF to each field before hashing (matching transfer.test.ts pattern)
  const fields = [
    modF(toBigInt(input.amount)),
    modF(toBigInt(input.ownerCipherPayPubKey)),  // ← Position 1: cipherPayPubKey
    modF(toBigInt(input.randomness?.r ?? 0)),    // ← Position 2: randomness
    modF(toBigInt(input.tokenId)),               // ← Position 3: tokenId
    modF(toBigInt(input.memo ?? 0))             // ← Position 4: memo (note: using r only, s is not used in circuit)
  ];
  return await poseidonHash(fields);
}
