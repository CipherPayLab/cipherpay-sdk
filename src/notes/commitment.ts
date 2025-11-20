import { poseidonHash } from "../crypto/poseidon.js";

export async function commitmentOf(
  input:
    | Array<bigint | number | string>
    | { amount: bigint | number | string; tokenId: bigint | number | string; ownerCipherPayPubKey: bigint | number | string; randomness: { r: bigint | number | string; s?: bigint | number | string }; memo?: bigint | number | string }
): Promise<bigint> {
  if (Array.isArray(input)) {
    return await poseidonHash(input);
  }
  // ORDER MUST MATCH CIRCUIT: [amount, cipherPayPubKey, randomness, tokenId, memo]
  const fields = [
    input.amount,
    input.ownerCipherPayPubKey,  // ← Position 1: cipherPayPubKey
    input.randomness?.r,         // ← Position 2: randomness
    input.tokenId,               // ← Position 3: tokenId
    input.memo ?? 0              // ← Position 4: memo (note: using r only, s is not used in circuit)
  ];
  return await poseidonHash(fields);
}
