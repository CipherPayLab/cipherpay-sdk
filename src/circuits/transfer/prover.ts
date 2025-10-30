import { ProveResult } from "../common/types.js";
import { loadArtifacts, loadJSON } from "../common/io.js";
import { prove, verify as verifyGroth16 } from "../common/groth16.js";
import artifacts from "./artifacts.json" assert { type: "json" };

// Shape TBD — placeholder for now
export interface TransferPublicSignals {
  newCommitment: string | bigint;
  nullifier: string | bigint;
  merkleRoot: string | bigint;
}

export interface TransferInput {
  // witness inputs expected by transfer.circom
  // e.g., old note fields, new note fields, path elements, etc.
  [k: string]: unknown;
}

export async function generateTransferProof(input: TransferInput): Promise<ProveResult<TransferPublicSignals>> {
  const art = await loadArtifacts(import.meta.url.replace(/prover\.ts$/, "artifacts.json"));
  const out = await prove<TransferPublicSignals>(art.wasm, art.zkey, input);
  if (art.vkey) {
    const vkey = await loadJSON(art.vkey);
    const ok = await verifyGroth16(vkey, out.publicSignals, out.proof);
    if (!ok) throw new Error("Transfer proof failed local verification");
  }
  return out;
}
