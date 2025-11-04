import { poseidonHash } from "../crypto/poseidon.js";

export async function commitmentOf(
  input:
    | Array<bigint | number | string>
    | { amount: bigint | number | string; tokenId: bigint | number | string; ownerCipherPayPubKey: bigint | number | string; randomness: { r: bigint | number | string; s?: bigint | number | string } }
): Promise<bigint> {
  if (Array.isArray(input)) {
    return await poseidonHash(input);
  }
  const fields = [
    input.amount,
    input.tokenId,
    input.ownerCipherPayPubKey,
    input.randomness?.r,
    input.randomness?.s ?? 0
  ];
  return await poseidonHash(fields);
}
