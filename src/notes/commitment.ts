import { Note, Commitment } from "../types/core.js";
import { poseidonN } from "../utils/crypto.js";

export async function commitmentOf(note: Note): Promise<Commitment> {
  // Canonical order; tokenId is already a field hash in v3 design
  const fields: bigint[] = [
    note.amount,
    note.tokenId,
    note.ownerCipherPayPubKey,
    note.randomness.r,
    note.randomness.s ?? 0n
  ];
  return await poseidonN(fields);
}
