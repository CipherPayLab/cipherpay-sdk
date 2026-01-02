import { ProveResult } from "../common/types.js";
import { loadArtifacts, loadJSON } from "../common/io.js";
import { prove, verify as verifyGroth16 } from "../common/groth16.js";
import artifacts from "./artifacts.json" with { type: "json" };

// audit_payment public signals (matching circuit)
export interface AuditPaymentPublicSignals {
  commitment: string | bigint;
  merkleRoot: string | bigint;
  amount: string | bigint;
  tokenId: string | bigint;
  memoHash: string | bigint;
}

export interface AuditPaymentInput {
  // Public inputs
  commitment: string;
  merkleRoot: string;
  amount: string;
  tokenId: string;
  memoHash: string;
  
  // Private witness
  cipherPayPubKey: string;
  randomness: string;
  memo: string;
  pathElements: string[];
  pathIndices: number[];
}

/** Prove audit payment and verify locally when vkey is present. */
export async function generateAuditPaymentProof(input: AuditPaymentInput): Promise<ProveResult<AuditPaymentPublicSignals>> {
  const art = await loadArtifacts(import.meta.url.replace(/prover\.ts$/, "artifacts.json"), "audit_payment");
  const out = await prove<AuditPaymentPublicSignals>(art.wasm, art.zkey, input as unknown as Record<string, unknown>);

  // Optional safety: local verify when vkey is available
  if (art.vkey) {
    const vkey = await loadJSON(art.vkey);
    const ok = await verifyGroth16(vkey, out.publicSignals, out.proof);
    if (!ok) throw new Error("Audit payment proof failed local verification");
  }
  return out;
}
