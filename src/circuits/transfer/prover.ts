import { ProveResult } from "../common/types.js";
import { loadArtifacts, loadJSON } from "../common/io.js";
import { prove, verify as verifyGroth16 } from "../common/groth16.js";
import artifacts from "./artifacts.json" with { type: "json" };

// Public signals order: OUT1, OUT2, NULLIFIER, MERKLE_ROOT, NEW_ROOT1, NEW_ROOT2, NEW_NEXT_IDX, ENC1, ENC2
// Can be either an array or an object with these fields
export type TransferPublicSignals = 
  | string[] 
  | number[] 
  | bigint[]
  | {
      OUT1?: string | bigint | number;
      OUT2?: string | bigint | number;
      NULLIFIER?: string | bigint | number;
      MERKLE_ROOT?: string | bigint | number;
      NEW_ROOT1?: string | bigint | number;
      NEW_ROOT2?: string | bigint | number;
      NEW_NEXT_IDX?: string | bigint | number;
      ENC1?: string | bigint | number;
      ENC2?: string | bigint | number;
      [key: number]: string | bigint | number;
      [key: string]: string | bigint | number | undefined;
    };

export interface TransferInput {
  // witness inputs expected by transfer.circom
  // e.g., old note fields, new note fields, path elements, etc.
  [k: string]: unknown;
}

export async function generateTransferProof(input: TransferInput): Promise<ProveResult<TransferPublicSignals>> {
  const art = await loadArtifacts(import.meta.url.replace(/prover\.ts$/, "artifacts.json"), "transfer");
  const out = await prove<TransferPublicSignals>(art.wasm, art.zkey, input as unknown as Record<string, unknown>);
  if (art.vkey) {
    const vkey = await loadJSON(art.vkey);
    const ok = await verifyGroth16(vkey, out.publicSignals, out.proof);
    if (!ok) throw new Error("Transfer proof failed local verification");
  }
  return out;
}
