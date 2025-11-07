import { z } from "zod";
function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string") {
    const s = v.trim();
    return BigInt(s.startsWith("0x") ? s : BigInt(s));
  }
  if (v && typeof (v as any).toString === "function") return BigInt((v as any).toString());
  throw new TypeError(`toBigInt: unsupported ${typeof v}`);
}

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
