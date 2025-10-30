import { z } from "zod";
import { toBigInt } from "./big.js";

export const DepositSignalsZ = z.object({
  amount: z.union([z.string(), z.number(), z.bigint()]),
  depositHash: z.union([z.string(), z.number(), z.bigint()]),
  newCommitment: z.union([z.string(), z.number(), z.bigint()]),
  ownerCipherPayPubKey: z.union([z.string(), z.number(), z.bigint()]),
  merkleRoot: z.union([z.string(), z.number(), z.bigint()]),
  nextLeafIndex: z.union([z.string(), z.number()]),
});

export type DepositSignals = z.infer<typeof DepositSignalsZ>;

export function bigintifySignals<T extends Record<string, unknown>>(s: T): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === "nextLeafIndex") continue; // u32 separately
    out[k] = toBigInt(v);
  }
  return out;
}
