import { ProveResult } from "../common/types.js";
import { loadArtifacts, loadJSON } from "../common/io.js";
import { prove, verify as verifyGroth16 } from "../common/groth16.js";
import artifacts from "./artifacts.json" with { type: "json" };

// v3 deposit public signals (shape you defined)
export interface DepositPublicSignals {
  amount: string | bigint;
  depositHash: string | bigint;
  newCommitment: string | bigint;
  ownerCipherPayPubKey: string | bigint;
  merkleRoot: string | bigint;
  nextLeafIndex: string | number;
}

export interface DepositInput {
  // exact witness inputs expected by your deposit.circom (match your template!)
  amount: string;                  // in field string form
  tokenId: string;
  ownerCipherPayPubKey: string;
  r: string;
  s?: string;
  merkleRoot: string;
  leafIndex: string;               // next index (stringified)
  siblings: string[];              // hex or decimal strings for field elements
  depositHash: string;             // if circuit expects it as public
  // ...any additional fields like note memo hash, etc.
}

/** Prove deposit and verify locally when vkey is present. */
export async function generateDepositProof(input: DepositInput): Promise<ProveResult<DepositPublicSignals>> {
  const art = await loadArtifacts(import.meta.url.replace(/prover\.ts$/, "artifacts.json"), "deposit");
  const out = await prove<DepositPublicSignals>(art.wasm, art.zkey, input as unknown as Record<string, unknown>);

  // Optional safety: local verify when vkey is available
  if (art.vkey) {
    const vkey = await loadJSON(art.vkey);
    const ok = await verifyGroth16(vkey, out.publicSignals, out.proof);
    if (!ok) throw new Error("Deposit proof failed local verification");
  }
  return out;
}
